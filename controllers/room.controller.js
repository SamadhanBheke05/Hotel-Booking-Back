import mongoose from "mongoose";
import Hotel from "../models/hotel.model.js";
import Room from "../models/room.model.js";
import { uploadToCloudinary } from "../config/multer.js";

// add a new room
export const addRoom = async (req, res) => {
    try {
        const {
            roomType,
            hotel,
            pricePerNight,
            description,
            amenities,
            isAvailable,
            rating,
        } = req.body;

        // Upload each file buffer to Cloudinary and collect secure URLs
        const images = req.files && req.files.length > 0
            ? await Promise.all(req.files.map((file) => uploadToCloudinary(file.buffer, file.mimetype)))
            : [];

        if (!hotel || !mongoose.Types.ObjectId.isValid(hotel)) {
            return res.status(400).json({ message: "Valid hotel is required" });
        }

        if (!roomType || !String(roomType).trim()) {
            return res.status(400).json({ message: "Room type is required" });
        }

        if (!description || !String(description).trim()) {
            return res.status(400).json({ message: "Description is required" });
        }

        const normalizedAmenities = Array.isArray(amenities)
            ? amenities.filter(Boolean).join(", ").trim()
            : String(amenities ?? "").trim();

        if (!normalizedAmenities) {
            return res.status(400).json({ message: "Amenities are required" });
        }

        const parsedPrice = Number(pricePerNight);
        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            return res.status(400).json({ message: "Valid price per night is required" });
        }

        const parsedRating = rating === "" || rating === undefined || rating === null
            ? 4.0
            : Number(rating);
        if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) {
            return res.status(400).json({ message: "Rating must be between 0 and 5" });
        }

        const parsedIsAvailable = typeof isAvailable === "boolean"
            ? isAvailable
            : String(isAvailable).toLowerCase() === "true";

        if (!images.length) {
            return res.status(400).json({ message: "At least one room image is required" });
        }

        const ownerHotel = await Hotel.findOne({ _id: hotel, owner: req.user.id }).select("_id");
        if (!ownerHotel) {
            return res.status(403).json({ message: "You can only add rooms to your own hotels" });
        }

        const newRoom = await Room.create({
            roomType: String(roomType).trim(),
            hotel,
            pricePerNight: parsedPrice,
            description: String(description).trim(),
            amenities: normalizedAmenities,
            isAvailable: parsedIsAvailable,
            rating: parsedRating,
            images,
        });

        return res.status(201).json({
            success: true,
            message: "Room added successfully",
            room: newRoom,
        });
    } catch (error) {
        if (error?.name === "ValidationError") {
            const firstMessage = Object.values(error.errors || {})[0]?.message || "Invalid room data";
            return res.status(400).json({ message: firstMessage });
        }
        console.error("Error in addRoom:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Get all rooms for specific owner
export const getOwnerRooms = async (req, res) => {
    try {
        const { id } = req.user;

        const rooms = await Room.find().populate({
            path: "hotel",
            select: "hotelName hotelAddress rating amenities owner",
        });

        const ownerRooms = rooms.filter((room) => room.hotel?.owner?.toString() === id.toString());

        return res.status(200).json({
            success: true,
            rooms: ownerRooms,
        });
    } catch (error) {
        console.error("Error in getOwnerRooms:", error);
        return res.status(500).json({ message: "Internal server Error" });
    }
};

export const getAllRooms = async (req, res) => {
    try {
        const rooms = await Room.find().populate({
            path: "hotel",
            select: "hotelName hotelAddress amenities rating owner groupBookingAllowed maxGroupMembers maxGroupRooms",
            populate: {
                path: "owner",
                select: "name email",
            },
        }).exec();

        return res.json({ success: true, rooms });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// update
export const updateRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const {
            roomType,
            hotel,
            pricePerNight,
            description,
            amenities,
            isAvailable,
            rating,
        } = req.body;

        if (!roomId || !mongoose.Types.ObjectId.isValid(roomId)) {
            return res.status(400).json({ message: "Valid room id is required" });
        }

        const room = await Room.findById(roomId).populate("hotel", "owner");
        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        const currentOwnerId = room.hotel?.owner?.toString();
        if (!currentOwnerId || currentOwnerId !== req.user.id.toString()) {
            return res.status(403).json({ message: "You can only update your own rooms" });
        }

        let targetHotelId = room.hotel?._id?.toString() || room.hotel?.toString();
        if (hotel && hotel !== targetHotelId) {
            if (!mongoose.Types.ObjectId.isValid(hotel)) {
                return res.status(400).json({ message: "Valid hotel is required" });
            }
            const ownerHotel = await Hotel.findOne({ _id: hotel, owner: req.user.id }).select("_id");
            if (!ownerHotel) {
                return res.status(403).json({ message: "You can only assign rooms to your own hotels" });
            }
            targetHotelId = hotel;
        }

        if (roomType !== undefined) {
            const nextRoomType = String(roomType).trim();
            if (!nextRoomType) return res.status(400).json({ message: "Room type is required" });
            room.roomType = nextRoomType;
        }

        if (description !== undefined) {
            const nextDescription = String(description).trim();
            if (!nextDescription) return res.status(400).json({ message: "Description is required" });
            room.description = nextDescription;
        }

        if (amenities !== undefined) {
            const normalizedAmenities = Array.isArray(amenities)
                ? amenities.filter(Boolean).join(", ").trim()
                : String(amenities ?? "").trim();
            if (!normalizedAmenities) return res.status(400).json({ message: "Amenities are required" });
            room.amenities = normalizedAmenities;
        }

        if (pricePerNight !== undefined) {
            const parsedPrice = Number(pricePerNight);
            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                return res.status(400).json({ message: "Valid price per night is required" });
            }
            room.pricePerNight = parsedPrice;
        }

        if (rating !== undefined) {
            const parsedRating = Number(rating);
            if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 5) {
                return res.status(400).json({ message: "Rating must be between 0 and 5" });
            }
            room.rating = parsedRating;
        }

        if (isAvailable !== undefined) {
            room.isAvailable = typeof isAvailable === "boolean"
                ? isAvailable
                : String(isAvailable).toLowerCase() === "true";
        }

        room.hotel = targetHotelId;

        if (req.files && req.files.length > 0) {
            room.images = await Promise.all(
                req.files.map((file) => uploadToCloudinary(file.buffer, file.mimetype))
            );
        }

        await room.save();

        return res.status(200).json({
            success: true,
            message: "Room updated successfully",
            room,
        });
    } catch (error) {
        if (error?.name === "ValidationError") {
            const firstMessage = Object.values(error.errors || {})[0]?.message || "Invalid room data";
            return res.status(400).json({ message: firstMessage });
        }
        console.error("Error in updateRoom:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// delete
export const deleteRoom = async (req, res) => {
    try {
        const { roomId } = req.params;
        const deletedRoom = await Room.findByIdAndDelete(roomId);

        if (!deletedRoom) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }

        return res.json({ success: true, message: "Room deleted successfully" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};
