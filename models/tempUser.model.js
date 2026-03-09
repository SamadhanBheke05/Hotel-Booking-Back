import mongoose from "mongoose";

const tempUserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    otp: { type: String, required: true },
    // TTL index: MongoDB automatically deletes the temp user once otpExpiry passes.
    otpExpiry: { type: Date, required: true, expires: 0 }
}, {
    timestamps: true
});

tempUserSchema.index({ email: 1 }, { unique: true });
tempUserSchema.index({ email: 1, otp: 1 });

export default mongoose.model("TempUser", tempUserSchema);
