import express from "express"

import authMiddleware from "../middlewares/auth.middleware.js";
import { isOwner } from "../middlewares/isOwner.js";

import { upload } from "../config/multer.js";
import { addRoom, deleteRoom, getAllRooms, getOwnerRooms, updateRoom } from "../controllers/room.controller.js";

const roomRouter = express.Router();

roomRouter.post("/add", authMiddleware, isOwner, upload.array("images"), addRoom);
roomRouter.put("/update/:roomId", authMiddleware, isOwner, upload.array("images"), updateRoom);
roomRouter.get("/get", authMiddleware, isOwner, getOwnerRooms);
roomRouter.get("/get-all", getAllRooms);
roomRouter.delete("/delete/:roomId", authMiddleware, isOwner, deleteRoom);
export default roomRouter;
