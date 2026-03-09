import express from "express";

import {
    isAuth,
    login,
    logout,
    singup,
    verifyOTP
} from "../controllers/user.controller.js";

import authMiddleware from "../middlewares/auth.middleware.js";


const userRouter = express.Router();

userRouter.post("/signup", singup);
userRouter.post("/verify-otp", verifyOTP);
userRouter.post("/login", login);

userRouter.get("/is-auth", (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return isAuth(req, res);
    return authMiddleware(req, res, next);
}, isAuth);
userRouter.get("/logout", authMiddleware, logout);

export default userRouter;
