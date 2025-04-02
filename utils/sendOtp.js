const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const OTP = require("../models/otp"); // Adjust path if needed
require("dotenv").config();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Send OTP function
const sendOTP = async (email) => {
  if (!email || !email.includes("@")) {
    throw new Error("Invalid email address.");
  }

  const otpCode = generateOTP();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // OTP valid for 10 minutes

  try {
    // Hash the OTP
    const hashedOTP = await bcrypt.hash(otpCode, 10);

    // Save OTP to database
    await OTP.findOneAndUpdate(
      { email },
      { otp: hashedOTP, expiresAt: expiry },
      { upsert: true, new: true }
    );

    // Send OTP via email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is ${otpCode}. It is valid for 10 minutes.`,
    });

    return { hashedOTP, otpExpiry: expiry };
  } catch (error) {
    console.error("Error sending OTP:", error);

    // Differentiate between database and email errors
    if (error.message.includes("Failed to send mail")) {
      throw new Error("Failed to send OTP email. Please check your email configuration.");
    } else {
      throw new Error("Failed to save OTP to the database.");
    }
  }
};

module.exports = sendOTP;