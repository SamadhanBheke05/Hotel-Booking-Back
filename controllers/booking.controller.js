import Booking from "../models/booking.model.js"
import Room from "../models/room.model.js"
import Hotel from "../models/hotel.model.js"
import User from "../models/user.model.js"
import {
    sendBookingConfirmationEmail,
    sendGroupBookingConfirmationEmail,
} from "../utils/sendEmail.js";

export const checkAvailability = async ({ room, checkInDate, checkOutDate }) => {
    try {
        const booking = await Booking.find({
            room,
            checkIn: { $lte: checkOutDate },
            checkOut: { $gte: checkInDate },
            status: { $ne: "cancelled" },
        });

        const isAvailable = booking.length === 0;
        return isAvailable;
    } catch (error) {
        console.error("Check availability error:", error);
    }
};

//api to check Availability of room
export const checkRoomAvailability = async (req, res) => {
    try {
        const { room, checkInDate, checkOutDate } = req.body;
        const isAvailable = await checkAvailability({
            room, checkInDate, checkOutDate
        });
        res.json({ success: true, isAvailable });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
}

//api to book a room
export const bookRoom = async (req, res) => {
    try {
        const { id } = req.user;
        const user = await User.findById(id);
        const { room, checkInDate, checkOutDate, persons, paymentMethod } = req.body;

        //before booking chcek availability
        const isAvailable = await checkAvailability({
            room, checkInDate, checkOutDate
        });
        if (!isAvailable) {
            return res.status(400).json({ message: "Room is not available", success: false });
        }

        //get totalprice for room

        const roomData = await Room.findById(room).populate("hotel");

        if (!roomData) {
            return res.status(404).json({ success: false, message: "Room not found" });
        }

        let totalPrice = roomData.pricePerNight;

        //calculate totalprice based on per night
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const timeDiff = checkOut.getTime() - checkIn.getTime();
        const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
        totalPrice = totalPrice * nights;


        const booking = await Booking.create({
            user: id,
            room,
            hotel: roomData.hotel._id,
            checkIn,
            checkOut,
            persons,
            totalPrice,
            paymentMethod,
        });

        res.json({ success: true, message: "Room Booked Successfully" });

        // Send email in background so booking response is not delayed by SMTP/network latency.
        if (user?.email) {
            setImmediate(async () => {
                try {
                    await sendBookingConfirmationEmail({
                        email: user.email,
                        name: user.name,
                        bookingId: booking._id,
                        hotelName: roomData.hotel.hotelName,
                        roomType: roomData.roomType,
                        checkInDate,
                        checkOutDate,
                        persons,
                        totalPrice,
                        currency: process.env.CURRENCY || "Rs",
                    });
                } catch (emailError) {
                    console.error("EMAIL_SEND_ERROR:", emailError);
                }
            });
        }
    } catch (error) {
        console.error("BOOKING_ERROR:", error); // Log the actual error
        res.status(500).json({ message: "Internal server error" });
    }
};

//api to get all booking for a user

export const getUserBookings = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let bookings = await Booking.find({ user: userId })
            .populate("hotel room")
            .sort({ createdAt: -1 });

        bookings = bookings.filter(booking => booking.room !== null && booking.hotel !== null);

        res.json({ success: true, bookings })
    } catch (error) {
        res.status(500).json({ message: "Internal server error" })
    }
};

//api to get all booking for a hotel (Global Admin View: Returns ALL bookings)
export const getHotelBookings = async (req, res) => {
    try {
        let bookings = await Booking.find({})
            .populate("room")
            .populate("hotel")
            .populate("user", "name email") // Added user populate for more info if needed
            .sort({ createdAt: -1 })
            .exec();

        // Filter out bookings where room or hotel has been deleted
        bookings = bookings.filter(b => b.room && b.hotel);

        res.json({ success: true, bookings });
    } catch (error) {
        console.error("GET_HOTEL_BOOKINGS_ERROR:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/* ===============================
   CREATE GROUP BOOKING
================================ */
export const createGroupBooking = async (req, res) => {
    try {
        const { id } = req.user;
        const { hotelId, roomIds, leaderName, totalMembers, checkInDate, checkOutDate } = req.body;

        if (!hotelId || !roomIds || !Array.isArray(roomIds) || roomIds.length === 0) {
            return res.status(400).json({ success: false, message: "Hotel and at least one room are required" });
        }
        if (!leaderName || !totalMembers || !checkInDate || !checkOutDate) {
            return res.status(400).json({ success: false, message: "Leader name, total members and dates are required" });
        }
        if (new Date(checkInDate) >= new Date(checkOutDate)) {
            return res.status(400).json({ success: false, message: "Check-out must be after check-in" });
        }

        // Fetch hotel and validate group booking settings
        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({ success: false, message: "Hotel not found" });
        }
        if (!hotel.groupBookingAllowed) {
            return res.status(400).json({ success: false, message: "This hotel does not allow group bookings" });
        }
        if (Number(totalMembers) > hotel.maxGroupMembers) {
            return res.status(400).json({
                success: false,
                message: `Max group members allowed is ${hotel.maxGroupMembers}`,
            });
        }
        if (roomIds.length > hotel.maxGroupRooms) {
            return res.status(400).json({
                success: false,
                message: `Max group rooms allowed is ${hotel.maxGroupRooms}`,
            });
        }

        // Check availability of all rooms and calculate total price
        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 3600 * 24)));

        const roomsData = [];
        let totalPrice = 0;

        for (const roomId of roomIds) {
            const isAvailable = await checkAvailability({ room: roomId, checkInDate, checkOutDate });
            if (!isAvailable) {
                return res.status(400).json({
                    success: false,
                    message: `Room ${roomId} is not available for selected dates`,
                });
            }
            const roomData = await Room.findById(roomId);
            if (!roomData) {
                return res.status(404).json({ success: false, message: `Room ${roomId} not found` });
            }
            const roomPrice = roomData.pricePerNight * nights;
            totalPrice += roomPrice;
            roomsData.push({ roomId: roomData._id, price: roomPrice });
        }

        // Generate unique group code
        const groupCode = "GRP" + Date.now().toString(36).toUpperCase();

        // Create group booking (use first room in the top-level `room` field for backward compat)
        const booking = await Booking.create({
            user: id,
            hotel: hotelId,
            room: roomIds[0],
            checkIn,
            checkOut,
            persons: Number(totalMembers),
            totalPrice,
            paymentMethod: "Pay At Hotel",
            bookingType: "group",
            groupCode,
            leaderName,
            totalRooms: roomIds.length,
            totalMembers: Number(totalMembers),
            rooms: roomsData,
        });

        // Send confirmation email (best effort)
        const user = await User.findById(id);
        if (user) {
            try {
                await sendGroupBookingConfirmationEmail({
                    email: user.email,
                    name: user.name,
                    groupCode,
                    hotelName: hotel.hotelName,
                    leaderName,
                    roomsCount: roomIds.length,
                    totalMembers,
                    checkInDate,
                    checkOutDate,
                    totalPrice,
                    currency: process.env.CURRENCY || "Rs",
                });
            } catch (emailErr) {
                console.error("GROUP_BOOKING_EMAIL_ERROR:", emailErr);
            }
        }

        return res.json({ success: true, message: "Group booking created successfully", groupCode, bookingId: booking._id });
    } catch (error) {
        console.error("CREATE_GROUP_BOOKING_ERROR:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/* ===============================
   GET USER GROUP BOOKINGS
================================ */
export const getUserGroupBookings = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const bookings = await Booking.find({ user: userId, bookingType: "group" })
            .populate("hotel")
            .populate("room")
            .populate("rooms.roomId", "roomType pricePerNight")
            .sort({ createdAt: -1 });
        return res.json({ success: true, bookings });
    } catch (error) {
        console.error("GET_GROUP_BOOKINGS_ERROR:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/* ===============================
   CANCEL GROUP BOOKING
================================ */
export const cancelGroupBooking = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }
        if (booking.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }
        if (booking.bookingType !== "group") {
            return res.status(400).json({ success: false, message: "Not a group booking" });
        }
        if (new Date() >= new Date(booking.checkIn)) {
            return res.status(400).json({ success: false, message: "Cannot cancel after check-in date" });
        }

        booking.status = "cancelled";
        booking.paymentStatus = "failed";
        booking.isPaid = false;
        await booking.save();

        return res.json({ success: true, message: "Group booking cancelled" });
    } catch (error) {
        console.error("CANCEL_GROUP_BOOKING_ERROR:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const cancelBooking = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        if (booking.user.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        if (new Date() >= new Date(booking.checkIn)) {
            return res.status(400).json({ success: false, message: "Cannot cancel after check-in date" });
        }

        booking.status = "cancelled";
        booking.cancelledBy = "user";
        booking.cancelledAt = new Date();
        booking.paymentStatus = "failed";
        booking.isPaid = false;

        await booking.save();

        res.json({ success: true, message: "Booking cancelled" });
    } catch (error) {
        console.error("Cancel booking error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

