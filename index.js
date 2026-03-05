import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"

import { connectDB } from "./config/connectDB.js";

import userRouter from "./routes/user.routes.js";
import hotelRouter from "./routes/hotel.routes.js";
import roomRouter from "./routes/room.routes.js";
import bookingRouter from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import ownerRoutes from "./routes/owner.routes.js";
import reviewRouter from "./routes/review.routes.js";
import { verifyEmailTransport } from "./utils/sendEmail.js";

dotenv.config();

const app = express();

app.set("trust proxy", 1);

// DB
connectDB();
verifyEmailTransport();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hotel-booking-frontend-equi.onrender.com",
];
const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const normalizeOrigin = (origin) => origin.replace(/\/$/, "");
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins].map(normalizeOrigin))];
const localDevOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i;
const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    return allowedOrigins.includes(normalized) || localDevOriginRegex.test(normalized);
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));

app.use(cookieParser());

// Test route
app.get("/", (req, res) => {
    res.send("Server Running 🚀");
});

const PORT = process.env.PORT || 5000;

app.use("/images", express.static("uploads"));

app.use("/api/user", userRouter);
app.use("/api/users", userRouter);
app.use("/api/hotel", hotelRouter);
app.use("/api/room", roomRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/payments", paymentRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/reviews", reviewRouter);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
