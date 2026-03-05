import express from "express";

import {
    isAuth,
    login,
    logout,
    resendOTP,
    singup,
    verifyOTP
} from "../controllers/user.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";


const userRouter = express.Router();

userRouter.post("/signup", singup);
userRouter.post("/verify-otp", verifyOTP);
userRouter.post("/resend-otp", resendOTP);
userRouter.post("/login", login);

userRouter.get("/is-auth", authMiddleware, isAuth);
userRouter.get("/logout", authMiddleware, logout);

export default userRouter;
