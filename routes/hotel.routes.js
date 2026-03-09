import express from "express"
import authMiddleware from "../middlewares/auth.middleware.js";
import { isOwner } from "../middlewares/isOwner.js"
import { deleteHotel, getAllHotels, getOwnerHotels, registerHotel, registerHotelV2, updateHotel } from "../controllers/hotel.controller.js";
import { upload } from "../config/multer.js";

const hotelRouter = express.Router();
const hotelRegisterUpload = upload.any();
const hotelImageUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "hotelImage", maxCount: 1 },
]);

hotelRouter.post("/register", authMiddleware, isOwner, hotelRegisterUpload, registerHotel);
hotelRouter.post("/register-v2", authMiddleware, isOwner, registerHotelV2);
hotelRouter.put("/update/:hotelId", authMiddleware, isOwner, hotelImageUpload, updateHotel);
hotelRouter.get("/get", authMiddleware, isOwner, getOwnerHotels);
hotelRouter.get("/get-all", getAllHotels);
hotelRouter.delete("/delete/:hotelId", authMiddleware, isOwner, deleteHotel);

export default hotelRouter;
