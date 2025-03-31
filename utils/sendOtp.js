const nodemailer = require('nodemailer');
require('dotenv').config();

// Send OTP function
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP

const sendOTP = async (email) => {
  const otpCode = generateOTP();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

  try {
    // Save OTP to DB
    await OTP.findOneAndUpdate(
      { email },
      { otp: otpCode, expiresAt: expiry },
      { upsert: true, new: true }
    );

    // Send OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otpCode}. It is valid for 10 minutes.`,
    });

    return { hashedOTP: otpCode, otpExpiry: expiry };  // Returning OTP details
  } catch (error) {
    throw new Error("Failed to send OTP");
  }
};

module.exports = sendOTP;
