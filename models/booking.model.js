import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hotel",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    checkIn: {
      type: Date,
      required: true,
    },
    checkOut: {
      type: Date,
      required: true,
    },
    persons: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "pending", "cancelled"],
      default: "pending",
    },
    totalPrice: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: "Pay At Hotel",
      required: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentInfo: {
      razorpayOrderId: String,
      razorpayPaymentId: String,
      razorpaySignature: String,
    },

    // === GROUP BOOKING FIELDS ===
    bookingType: {
      type: String,
      enum: ["single", "group"],
      default: "single",
    },
    groupCode: { type: String },
    leaderName: { type: String },
    totalRooms: { type: Number },
    totalMembers: { type: Number },
    rooms: [
      {
        roomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Room",
        },
        price: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

// Speeds up room/date overlap lookups used during availability checks.
bookingSchema.index({ room: 1, checkIn: 1, checkOut: 1, status: 1 });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
