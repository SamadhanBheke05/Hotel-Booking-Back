import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

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

// Static uploads (legacy support for previously stored local images)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// DB
connectDB();
if (String(process.env.VERIFY_EMAIL_ON_BOOT || "false").toLowerCase() === "true") {
    verifyEmailTransport();
}

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://hotel-booking-frontend-scnq.onrender.com",
];
const envOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
const normalizeOrigin = (origin) => origin.replace(/\/$/, "");
const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins].map(normalizeOrigin))];
const localDevOriginRegex = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i;
const renderOriginRegex = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i;
const isAllowedOrigin = (origin) => {
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    return (
        allowedOrigins.includes(normalized) ||
        localDevOriginRegex.test(normalized) ||
        renderOriginRegex.test(normalized)
    );
};

app.use(cors({
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        console.error(`CORS_BLOCKED origin=${origin || "unknown"}`);
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

// Images are now served from Cloudinary (persistent storage)

app.use("/api/user", userRouter);
app.use("/api/users", userRouter);
app.use("/api/hotel", hotelRouter);
app.use("/api/room", roomRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/payments", paymentRoutes);
app.use("/api/owner", ownerRoutes);
app.use("/api/reviews", reviewRouter);

app.use((err, req, res, next) => {
    if (!err) return next();

    if (err.name === "MulterError") {
        return res.status(400).json({
            success: false,
            message: err.message || "File upload error",
        });
    }

    if (err.message === "Only image files are allowed") {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }

    console.error("UNHANDLED_ERROR:", err);
    return res.status(500).json({
        success: false,
        message: "Internal server error",
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
