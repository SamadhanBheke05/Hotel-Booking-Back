import multer from "multer";
import dotenv from "dotenv";
dotenv.config();

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
 * Upload a single file buffer to Cloudinary using an unsigned preset (no API key needed).
 * Uses the Cloudinary REST API directly via fetch.
 * Returns the secure_url string.
 */
export const uploadToCloudinary = async (fileBuffer, mimetype) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "df5xvr5ow";
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || "hotel_unsigned_upload";

  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimetype });
  formData.append("file", blob);
  formData.append("upload_preset", uploadPreset);
  formData.append("folder", "hotel_booking");

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const data = await response.json();
  return data.secure_url;
};
