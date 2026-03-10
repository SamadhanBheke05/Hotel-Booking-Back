import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
});

// Use memory storage — files are uploaded to Cloudinary in the controller
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

export const upload = multer({ storage, fileFilter });

/**
 * Upload a single file buffer to Cloudinary using an unsigned preset.
 * Returns the secure_url string.
 */
export const uploadToCloudinary = (fileBuffer, mimetype) => {
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "hotel_unsigned_upload";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "hotel_booking",
        upload_preset: uploadPreset,
        resource_type: "image",
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
};
