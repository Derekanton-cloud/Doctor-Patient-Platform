const User = require("../models/user");
const OTP = require("../models/otp");
const sendOTP = require("../utils/sendOtp");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();

// Configure Email Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Register User
exports.registerUser = async (req, res) => {
  try {
    const {
      role,
      firstName,
      lastName,
      dob,
      gender,
      email,
      phone,
      emergencyContact,
      languages,
      password,
      bloodGroup,
      medicalHistory,
      medicalFiles,
      licenseNumber,
      licenseCertificate,
      boardCertificate,
      specialization,
      hospitalName,
      doctorPhoto,
    } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("User already exists:", existingUser); // Debugging log
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User Object
    const user = new User({
      role,
      firstName,
      lastName,
      dob,
      gender,
      email,
      phone,
      emergencyContact,
      languages,
      password: hashedPassword,
    });

    // Role-based fields
    if (role === "patient") {
      user.bloodGroup = bloodGroup;
      user.medicalHistory = medicalHistory;
      user.medicalFiles = medicalFiles;
      user.patientId = `P-${Date.now()}`;
    } else if (role === "doctor") {
      user.licenseNumber = licenseNumber;
      user.licenseCertificate = licenseCertificate;
      user.boardCertificate = boardCertificate;
      user.specialization = specialization;
      user.hospitalName = hospitalName;
      user.doctorPhoto = doctorPhoto;
      user.doctorId = `D-${Date.now()}`;
      user.isApproved = false; // Pending admin approval
    }

    // Send and store OTP
    const { hashedOTP, otpExpiry } = await sendOTP(email);
    const hashedOtp = await bcrypt.hash(hashedOTP, 10); // Hash OTP before storing it
    user.otp = hashedOtp;
    user.otpExpiry = otpExpiry;

    await user.save();
    res.status(200).json({ message: "User registered. OTP sent to email." });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "Invalid OTP format. Must be 6 digits." });
    }

    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord) return res.status(400).json({ error: "OTP not found or expired." });

    // Check if OTP is expired
    if (Date.now() > otpRecord.expiresAt) {
      await OTP.deleteOne({ email }); // Remove expired OTP
      return res.status(400).json({ error: "OTP expired. Please request a new one." });
    }

    // Fetch user
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    // Verify OTP
    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOtpValid) return res.status(400).json({ error: "Invalid OTP" });

    // Mark user as verified
    await User.updateOne({ email }, { $set: { isVerified: true } });

    // Delete OTP after verification
    await OTP.deleteOne({ email });

    // Doctor-specific logic: Notify Admins for approval
    if (user.role === "doctor") {
      const adminEmails = ["derekanton30@gmail.com", "benedictmohan23@gmail.com"];
      const attachments = [];

      if (user.licenseCertificate) {
        attachments.push({ filename: "License_Certificate.pdf", path: user.licenseCertificate });
      }
      if (user.boardCertificate) {
        attachments.push({ filename: "Board_Certificate.pdf", path: user.boardCertificate });
      }
      if (user.governmentID) {
        attachments.push({ filename: "Government_ID.pdf", path: user.governmentID });
      }
      if (user.doctorPhoto) {
        attachments.push({ filename: "Doctor_Photo.jpg", path: user.doctorPhoto });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: adminEmails,
        subject: "New Doctor Registration Approval Required",
        text: `Doctor ${user.firstName} ${user.lastName} has registered and is awaiting approval.\nEmail: ${user.email}\nSpecialization: ${user.specialization}`,
        attachments,
      });

      return res.status(200).json({ message: "OTP verified. Waiting for admin approval." });
    }

    // For other roles, generate JWT token
    const token = generateToken(user);
    res.status(200).json({ message: "OTP verified successfully.", token });
  } catch (err) {
    console.error("❌ OTP Verification Error:", err);
    res.status(500).json({ error: "OTP verification failed" });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });

    const { hashedOTP, otpExpiry } = await sendOTP(email);
    await OTP.updateOne({ email }, { $set: { otp: hashedOTP, expiresAt: otpExpiry } }, { upsert: true });

    res.status(200).json({ message: "New OTP sent to email." });
  } catch (err) {
    console.error("❌ Resend OTP Error:", err);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
};

exports.sendTestOTP = async (req, res) => {
  const { email } = req.body; // Get email from request body
  try {
    const { hashedOTP, otpExpiry } = await sendOTP(email); // Call sendOTP function
    res.status(200).json({ message: "OTP sent successfully.", otp: hashedOTP }); // Respond with success message
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP" }); // Handle error
  }
};


exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found" });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ error: "Invalid credentials" });

    if (!user.isVerified) return res.status(400).json({ error: "Please verify your email first." });

    // Set the user ID in the session
    req.session.userId = user._id; // Add this line to set the session
    console.log("Session userId set to:", req.session.userId); // Debugging log

    const token = generateToken(user);
    res.status(200).json({ message: "Login successful.", token });
  } catch (err) {
    console.error("Login Error:", err); // Debugging log
    res.status(500).json({ error: "Login failed" });
  }
};

// Forgot Password - Request OTP
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { hashedOTP, otpExpiry } = await sendOTP(email);
    await OTP.updateOne({ email }, { $set: { otp: hashedOTP, expiresAt: otpExpiry } }, { upsert: true });

    res.status(200).json({ message: "OTP sent to email for password reset." });
  } catch (err) {
    res.status(500).json({ error: "Failed to send OTP" });
  }
};

// Reset Password - Verify OTP and Update Password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const otpRecord = await OTP.findOne({ email });
    if (!otpRecord || Date.now() > otpRecord.expiresAt) return res.status(400).json({ error: "OTP expired or not found." });

    const isOtpValid = await bcrypt.compare(otp, otpRecord.otp);
    if (!isOtpValid) return res.status(400).json({ error: "Invalid OTP" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.updateOne({ email }, { $set: { password: hashedPassword } });
    await OTP.deleteOne({ email });

    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to reset password" });
  }
};
