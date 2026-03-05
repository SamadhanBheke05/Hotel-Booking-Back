import User from "../models/user.model.js";
import TempUser from "../models/tempUser.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import otpGenerator from "otp-generator";
import { sendOTPEmail } from "../utils/sendEmail.js";

/* ===============================
   🔒 PASSWORD VALIDATION HELPER
================================ */
const isStrongPassword = (password) => {
  const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  return regex.test(password);
};

/* ===============================
   SIGNUP → SEND OTP (NO USER CREATED)
================================ */
export const singup = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const { password, role, adminCode } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    if (role === "owner") {
      if (!adminCode) {
        return res.status(400).json({
          message: "Admin code is required for Admin role",
          success: false,
        });
      }
      if (adminCode !== process.env.ADMIN_CODE) {
        return res.status(400).json({
          message: "Invalid Admin Code",
          success: false,
        });
      }
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters long, include 1 uppercase letter and 1 number",
        success: false,
      });
    }

    // check if real user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
        success: false,
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false
    });

    // remove old temp user if exists
    await TempUser.deleteMany({ email });

    // save temp user
    await TempUser.create({
      name,
      email,
      password: hashedPassword,
      role,
      otp,
      otpExpiry: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    try {
      await sendOTPEmail(email, otp);
      return res.json({
        message: "OTP sent to your email",
        success: true,
      });
    } catch (mailError) {
      console.error("OTP Email Error:", mailError);
      return res.status(500).json({
        message: "Unable to send OTP email. Please verify email config and try again.",
        success: false,
      });
    }
  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

/* ===============================
   VERIFY OTP → CREATE REAL USER
================================ */
export const verifyOTP = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email and OTP are required",
        success: false,
      });
    }

    const tempUser = await TempUser.findOne({ email, otp });

    if (!tempUser) {
      return res.status(401).json({
        message: "Invalid OTP",
        success: false,
      });
    }

    if (tempUser.otpExpiry < Date.now()) {
      return res.status(401).json({
        message: "OTP expired",
        success: false,
      });
    }

    // create real user
    const newUser = new User({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password,
      role: tempUser.role,
    });

    await newUser.save();

    // delete temp user
    await TempUser.deleteOne({ email });

    return res.json({
      message: "User registered successfully",
      success: true,
    });
  } catch (error) {
    console.error("OTP Verify Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

/* ===============================
   LOGIN
================================ */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "All fields are required",
        success: false,
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        message: "User not found",
        success: false,
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "You are suspended by admin",
        success: false,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid password",
        success: false,
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "5d" }
    );

    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 5 * 24 * 60 * 60 * 1000, // 5 days to match JWT expiry
    };

    res.cookie("token", token, cookieOptions);

    return res.json({
      message: "Login successful",
      success: true,
      user,
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

/* ===============================
   LOGOUT
================================ */
export const logout = async (req, res) => {
  try {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("token", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
    });
    return res.json({
      message: "Logout successful",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};

/* ===============================
   IS AUTH
================================ */
export const isAuth = async (req, res) => {
  try {
    const { id } = req.user;

    const user = await User.findById(id).select("-password");

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Internal server error",
      success: false,
    });
  }
};
