import dotenv from "dotenv";
import transporter, {
    emailUser,
    emailPass,
    mailService,
    smtpHost,
    smtpPort,
    smtpSecure,
} from "../config/nodemailer.js";

dotenv.config();

const emailFrom = process.env.EMAIL_FROM || emailUser;

export const verifyEmailTransport = async () => {
    try {
        await transporter.verify();
        if (smtpHost) {
            console.log(
                `EMAIL_OK mode=host host=${smtpHost} port=${smtpPort} secure=${smtpSecure} user=${emailUser || "missing"}`
            );
        } else {
            console.log(
                `EMAIL_OK mode=service service=${mailService} user=${emailUser || "missing"}`
            );
        }
    } catch (error) {
        if (smtpHost) {
            console.error(
                `EMAIL_FAIL mode=host host=${smtpHost} port=${smtpPort} secure=${smtpSecure}`,
                error?.message || error
            );
        } else {
            console.error(
                `EMAIL_FAIL mode=service service=${mailService}`,
                error?.message || error
            );
        }
    }
};

const sendEmail = async ({ to, subject, html }) => {
    if (!emailUser || !emailPass) {
        throw new Error("EMAIL_USER/EMAIL_PASS missing for Nodemailer email");
    }

    const info = await transporter.sendMail({
        from: `Hotel Booking <${emailFrom}>`,
        to,
        subject,
        html,
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (!accepted.length || rejected.length) {
        throw new Error(
            `Mail not delivered. accepted=${accepted.join(",")} rejected=${rejected.join(",")}`
        );
    }

    return info;
};

export const sendOTPEmail = async (email, otp) => {
    try {
        const info = await sendEmail({
            to: email,
            subject: "Email Verification OTP",
            html: `
                <h2>Your OTP is: ${otp}</h2>
                <p>This OTP expires in 5 minutes.</p>
            `,
        });
        console.log(`OTP email sent successfully to ${email}. messageId=${info.messageId}`);
    } catch (error) {
        console.error("Failed to send OTP email:", error);
        throw error;
    }
};

export const sendBookingConfirmationEmail = async ({
    email,
    name,
    bookingId,
    hotelName,
    roomType,
    checkInDate,
    checkOutDate,
    persons,
    totalPrice,
    currency = "Rs",
}) => {
    return sendEmail({
        to: email,
        subject: "Room Booking Confirmation",
        html: `
            <h1>Hotel Booking Confirmation</h1>
            <p>Dear ${name},</p>
            <p>Thank you for booking with us. Your booking details are as follows:</p>
            <ul>
                <li><strong>Booking ID:</strong> ${bookingId}</li>
                <li><strong>Hotel:</strong> ${hotelName}</li>
                <li><strong>Room Type:</strong> ${roomType}</li>
                <li><strong>Check-in Date:</strong> ${checkInDate}</li>
                <li><strong>Check-out Date:</strong> ${checkOutDate}</li>
                <li><strong>Number of Persons:</strong> ${persons}</li>
                <li><strong>Total Price:</strong> ${currency} ${totalPrice}</li>
            </ul>
        `,
    });
};

export const sendGroupBookingConfirmationEmail = async ({
    email,
    name,
    groupCode,
    hotelName,
    leaderName,
    roomsCount,
    totalMembers,
    checkInDate,
    checkOutDate,
    totalPrice,
    currency = "Rs",
}) => {
    return sendEmail({
        to: email,
        subject: "Group Booking Confirmation",
        html: `
            <h2>Group Booking Confirmation</h2>
            <p>Dear ${name},</p>
            <p>Your group booking has been confirmed.</p>
            <ul>
                <li><strong>Group Code:</strong> ${groupCode}</li>
                <li><strong>Hotel:</strong> ${hotelName}</li>
                <li><strong>Leader:</strong> ${leaderName}</li>
                <li><strong>Rooms Booked:</strong> ${roomsCount}</li>
                <li><strong>Total Members:</strong> ${totalMembers}</li>
                <li><strong>Check-in:</strong> ${checkInDate}</li>
                <li><strong>Check-out:</strong> ${checkOutDate}</li>
                <li><strong>Total Price:</strong> ${currency}${totalPrice}</li>
            </ul>
        `,
    });
};
