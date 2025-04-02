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

// Check if user already exists
exports.checkUserExists = async (req, res) => {
  try {
    const { email } = req.query; // Get email from query params
    const user = await User.findOne({ email });

    return res.json({ exists: !!user }); // Return true if user exists
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Register User
exports.registerUser = async (req, res) => {
  try {
    console.log("Processing Registration...");
    console.log("Received Data:", req.body);
    console.log("Received Files:", req.files);

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
      licenseNumber,
      specialization,
      hospitalName,
    } = req.body;

    // Fetch Uploaded Files
    const medicalFiles = req.files?.medicalFiles?.map(file => file.path) || [];
    const governmentIssuedIdPatient = req.files?.governmentIssuedIdPatient?.map(file => file.path) || [];
    const licenseCertificate = req.files?.licenseCertificate?.[0]?.path || null;
    const boardIssuedDocument = req.files?.boardCertificate?.[0]?.path || null;
    const governmentIssuedId = req.files?.governmentIssuedId?.[0]?.path || null;

    // Validation: Required Fields
    if (!firstName || !lastName || !dob || !gender || !email || !phone || !emergencyContact || !languages || !password) {
      return res.status(400).json({ success: false, message: "All required fields must be filled." });
    }

    // Role-based Validation
    if (role === "doctor" && (!licenseNumber || !specialization || !hospitalName || !licenseCertificate || !boardCertificate)) {
      return res.status(400).json({ success: false, message: "Doctors must provide all required details and documents." });
    }

    if (role === "patient" && (!bloodGroup || !medicalHistory || medicalFiles.length === 0)) {
      return res.status(400).json({ success: false, message: "Patients must provide blood group, medical history, and files." });
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "User already exists." });
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
      isVerified: false, // Initial status
    });

    if (role === "patient") {
      user.bloodGroup = bloodGroup;
      user.medicalHistory = medicalHistory;
      user.medicalFiles = medicalFiles;
      user.governmentIssuedIdPatient = governmentIssuedIdPatient;
      user.patientId = `P-${Date.now()}`;
    } else if (role === "doctor") {
      user.licenseNumber = licenseNumber;
      user.licenseCertificate = licenseCertificate;
      user.boardCertificate = boardIssuedDocument;
      user.specialization = specialization;
      user.hospitalName = hospitalName;
      user.governmentIssuedId = governmentIssuedId;
      user.doctorId = `D-${Date.now()}`;
      user.isApproved = false; // Pending admin approval
    }

    // Send and store OTP
    try {
      const { hashedOTP, otpExpiry } = await sendOTP(email);
      user.otp = hashedOTP;
      user.otpExpiry = otpExpiry;
    } catch (otpError) {
      console.error("Error sending OTP:", otpError);
      return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
    }

    // Save the user to the database
    try {
      await user.save();
      res.status(200).json({ success: true, message: "User registered. OTP sent to email." });
    } catch (dbError) {
      console.error("Error saving user to database:", dbError);
      return res.status(500).json({ success: false, message: "Failed to save user. Please try again." });
    }
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

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

// Delete User
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.body.userId; // Assuming user ID is sent in the request body
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
