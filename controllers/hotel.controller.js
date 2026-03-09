import Hotel from "../models/hotel.model.js";

const isBlank = (val) => val === undefined || val === null || String(val).trim() === "";
const parseBoolean = (val) => val === true || String(val).toLowerCase() === "true";
const getUploadedHotelImage = (req) => {
    if (req.file?.filename) return req.file.filename;
    if (req.files?.image?.[0]?.filename) return req.files.image[0].filename;
    if (req.files?.hotelImage?.[0]?.filename) return req.files.hotelImage[0].filename;
    if (Array.isArray(req.files) && req.files.length > 0 && req.files[0]?.filename) {
        return req.files[0].filename;
    }
    return "";
};

const buildHotelPayload = ({ ownerId, body, image }) => {
    const {
        hotelName,
        hotelAddress,
        rating,
        price,
        amenities,
        groupBookingAllowed,
        maxGroupMembers,
        maxGroupRooms,
    } = body;

    const numericRating = Number(rating);
    const numericPrice = Number(price);
    const allowGroupBooking = parseBoolean(groupBookingAllowed);
    const parsedMaxGroupMembers = Number(maxGroupMembers);
    const parsedMaxGroupRooms = Number(maxGroupRooms);

    if (!ownerId) {
        return { error: { status: 401, message: "Unauthorized - owner id missing" } };
    }
    if (isBlank(hotelName)) {
        return { error: { status: 400, message: "Hotel name is required" } };
    }
    if (isBlank(hotelAddress)) {
        return { error: { status: 400, message: "Hotel address is required" } };
    }
    if (isBlank(amenities)) {
        return { error: { status: 400, message: "Amenities are required" } };
    }
    if (!Number.isFinite(numericRating) || numericRating < 0 || numericRating > 5) {
        return { error: { status: 400, message: "Rating must be between 0 and 5" } };
    }
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return { error: { status: 400, message: "Price must be a valid non-negative number" } };
    }
    if (isBlank(image)) {
        return { error: { status: 400, message: "Hotel image is required" } };
    }
    if (allowGroupBooking) {
        if (!Number.isFinite(parsedMaxGroupMembers) || parsedMaxGroupMembers < 1) {
            return { error: { status: 400, message: "Max group members must be at least 1" } };
        }
        if (!Number.isFinite(parsedMaxGroupRooms) || parsedMaxGroupRooms < 1) {
            return { error: { status: 400, message: "Max group rooms must be at least 1" } };
        }
    }

    return {
        payload: {
            hotelName: String(hotelName).trim(),
            hotelAddress: String(hotelAddress).trim(),
            rating: String(numericRating),
            price: String(numericPrice),
            amenities: String(amenities).trim(),
            image: String(image).trim(),
            owner: ownerId,
            groupBookingAllowed: allowGroupBooking,
            maxGroupMembers: allowGroupBooking ? parsedMaxGroupMembers : 0,
            maxGroupRooms: allowGroupBooking ? parsedMaxGroupRooms : 0,
        },
    };
};

export const registerHotel = async (req, res) => {
    try {
        const ownerId = req.user?.id || req.user?._id;
        const image = getUploadedHotelImage(req);
        const { payload, error } = buildHotelPayload({ ownerId, body: req.body, image });
        if (error) {
            return res.status(error.status).json({ message: error.message, success: false });
        }

        const newHotel = new Hotel(payload);
        await newHotel.save();
        return res.status(201).json({ message: "Hotel registered successfully", success: true });
    } catch (error) {
        console.error("Register Hotel Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export const registerHotelV2 = async (req, res) => {
    try {
        const ownerId = req.user?.id || req.user?._id;
        const imageUrl = String(req.body?.imageUrl || "").trim();
        const { payload, error } = buildHotelPayload({ ownerId, body: req.body, image: imageUrl });
        if (error) {
            return res.status(error.status).json({ message: error.message, success: false });
        }

        const newHotel = new Hotel(payload);
        await newHotel.save();
        return res.status(201).json({ message: "Hotel registered successfully", success: true });
    } catch (error) {
        console.error("Register Hotel V2 Error:", error);
        return res.status(500).json({ message: "Internal server error", success: false });
    }
};

// Update hotel (including group booking settings)
export const updateHotel = async (req, res) => {
    const { hotelId } = req.params;
    try {
        const ownerId = req.user?.id || req.user?._id;
        if (!ownerId) {
            return res.status(401).json({ message: "Unauthorized - owner id missing", success: false });
        }

        const hotel = await Hotel.findById(hotelId);
        if (!hotel) {
            return res.status(404).json({ message: "Hotel not found", success: false });
        }
        if (hotel.owner?.toString() !== ownerId.toString()) {
            return res.status(403).json({ message: "You can only update your own hotels", success: false });
        }

        const { hotelName, hotelAddress, rating, price, amenities,
            groupBookingAllowed, maxGroupMembers, maxGroupRooms } = req.body;
        const nextImage = getUploadedHotelImage(req);

        if (hotelName !== undefined) {
            if (isBlank(hotelName)) {
                return res.status(400).json({ message: "Hotel name is required", success: false });
            }
            hotel.hotelName = String(hotelName).trim();
        }
        if (hotelAddress !== undefined) {
            if (isBlank(hotelAddress)) {
                return res.status(400).json({ message: "Hotel address is required", success: false });
            }
            hotel.hotelAddress = String(hotelAddress).trim();
        }
        if (rating !== undefined) {
            const numericRating = Number(rating);
            if (!Number.isFinite(numericRating) || numericRating < 0 || numericRating > 5) {
                return res.status(400).json({ message: "Rating must be between 0 and 5", success: false });
            }
            hotel.rating = String(numericRating);
        }
        if (price !== undefined) {
            const numericPrice = Number(price);
            if (!Number.isFinite(numericPrice) || numericPrice < 0) {
                return res.status(400).json({ message: "Price must be a valid non-negative number", success: false });
            }
            hotel.price = String(numericPrice);
        }
        if (amenities !== undefined) {
            if (isBlank(amenities)) {
                return res.status(400).json({ message: "Amenities are required", success: false });
            }
            hotel.amenities = String(amenities).trim();
        }

        if (groupBookingAllowed !== undefined) {
            hotel.groupBookingAllowed = parseBoolean(groupBookingAllowed);
            if (!hotel.groupBookingAllowed) {
                hotel.maxGroupMembers = 0;
                hotel.maxGroupRooms = 0;
            }
        }
        if (hotel.groupBookingAllowed && maxGroupMembers !== undefined) {
            const parsedMembers = Number(maxGroupMembers);
            if (!Number.isFinite(parsedMembers) || parsedMembers < 1) {
                return res.status(400).json({ message: "Max group members must be at least 1", success: false });
            }
            hotel.maxGroupMembers = parsedMembers;
        }
        if (hotel.groupBookingAllowed && maxGroupRooms !== undefined) {
            const parsedRooms = Number(maxGroupRooms);
            if (!Number.isFinite(parsedRooms) || parsedRooms < 1) {
                return res.status(400).json({ message: "Max group rooms must be at least 1", success: false });
            }
            hotel.maxGroupRooms = parsedRooms;
        }

        if (nextImage) {
            hotel.image = nextImage;
        }

        await hotel.save();
        return res.status(200).json({ message: "Hotel updated successfully", success: true, hotel });
    } catch (error) {
        console.error("Update Hotel Error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

//Get owner hotels
export const getOwnerHotels = async (req, res) => {
    const { id } = req.user;
    try {
        const hotels = await Hotel.find({ owner: id }).populate("owner", "name email");
        return res.status(200).json({ hotels, success: true });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

//Get all hotels
export const getAllHotels = async (req, res) => {
    try {
        const hotels = await Hotel.find({}).populate("owner", "name email");
        return res.status(200).json({ hotels, success: true });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

//delete hotel
export const deleteHotel = async (req, res) => {
    const { hotelId } = req.params;
    try {
        const deletedHotel = await Hotel.findByIdAndDelete(hotelId);
        if (!deletedHotel) {
            return res.status(404).json({ message: "Hotel not Found" });
        } else {
            return res.status(200).json({ message: "Hotel Deleted Successfully", success: true });
        }
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
};
