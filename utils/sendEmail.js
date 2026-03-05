import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const emailUser = process.env.EMAIL_USER || "";
const emailPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");
const resendApiKey = process.env.RESEND_API_KEY || "";
const resendFrom = process.env.EMAIL_FROM || emailUser;

const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    requireTLS: !smtpSecure,
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    auth: {
        user: emailUser,
        pass: emailPass,
    },
});

const sendViaResend = async ({ to, subject, html }) => {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: resendFrom,
            to: [to],
            subject,
            html,
        }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            `Resend API failed (${response.status}): ${JSON.stringify(data)}`
        );
    }

    return data;
};

const sendViaSmtp = async ({ to, subject, html }) => {
    const info = await transporter.sendMail({
        from: `Hotel Booking <${emailUser}>`,
        to,
        subject,
        html,
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (!accepted.length || rejected.length) {
        throw new Error(
            `SMTP mail not delivered. accepted=${accepted.join(",")} rejected=${rejected.join(",")}`
        );
    }
    return info;
};

const sendEmail = async ({ to, subject, html }) => {
    // Prefer HTTPS provider in production runtime (avoids SMTP connection timeouts).
    if (resendApiKey) {
        return sendViaResend({ to, subject, html });
    }
    if (!emailUser || !emailPass) {
        throw new Error(
            "Email credentials missing: set RESEND_API_KEY (recommended) or EMAIL_USER/EMAIL_PASS"
        );
    }
    return sendViaSmtp({ to, subject, html });
};

export const verifyEmailTransport = async () => {
    try {
        if (resendApiKey) {
            console.log(`EMAIL_OK mode=resend from=${resendFrom}`);
            return;
        }

        await transporter.verify();
        console.log(
            `EMAIL_OK mode=smtp host=${smtpHost} port=${smtpPort} secure=${smtpSecure} user=${emailUser || "missing"}`
        );
    } catch (error) {
        if (resendApiKey) {
            console.error("EMAIL_FAIL mode=resend", error?.message || error);
        } else {
            console.error(
                `EMAIL_FAIL mode=smtp host=${smtpHost} port=${smtpPort} secure=${smtpSecure}`,
                error?.message || error
            );
        }
    }
};

export const sendOTPEmail = async (email, otp) => {
    try {
        const html = `
            <h2>Your OTP is: ${otp}</h2>
            <p>This OTP expires in 5 minutes.</p>
        `;
        const result = await sendEmail({
            to: email,
            subject: "Email Verification OTP",
            html,
        });
        console.log("OTP email sent successfully", result?.id || "");
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
    await sendEmail({
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
    await sendEmail({
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
