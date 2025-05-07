const User = require("../models/user");
const OTP = require("../models/otp");
const sendOTP = require("../utils/sendOtp");
const { hashPassword } = require('../utils/passwordUtils'); // Import the utility
const { verifyPassword } = require('../utils/passwordUtils'); // Import the utility
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
      currentWorkingHospital,
    } = req.body;

    // Fetch Uploaded Files
    const medicalFiles = req.files?.medicalFiles?.map(file => file.path) || [];
    const governmentIssuedIdPatient = req.files?.governmentIssuedIdPatient?.map(file => file.path) || [];
    const licenseCertificates = req.files?.licenseCertificates?.map(file => file.path) || [];
    const boardIssuedDocuments = req.files?.boardCertificates?.map(file => file.path) || [];
    const governmentIssuedIds = req.files?.governmentIssuedIds?.map(file => file.path) || [];

    // Validation: Required Fields
    if (!firstName || !lastName || !dob || !gender || !email || !phone || !emergencyContact || !languages || !password) {
      return res.status(400).json({ success: false, message: "All required fields must be filled." });
    }

    // Role-based Validation
    if (role === "doctor" && (!licenseNumber || !specialization || !currentWorkingHospital || !licenseCertificates.length === 0 || !boardIssuedDocuments.length === 0 || !governmentIssuedIds.length === 0)) {
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
      password,
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
      user.licenseCertificates = licenseCertificates;
      user.boardIssuedDocuments = boardIssuedDocuments;
      user.specialization = specialization;
      user.currentWorkingHospital = currentWorkingHospital;
      user.governmentIssuedIds = governmentIssuedIds;
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
      res.status(200).json({ success: true, message: "User registered. OTP sent to email.", redirect: "/login" });
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
    console.log("🔍 Verifying OTP for:", email);

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: "Invalid OTP format. Must be 6 digits." });
    }

    const otpRecord = await OTP.findOne({
      email,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      console.log("❌ No valid OTP found for:", email);
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found"
      });
    }
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
      const adminEmails = ["derekanton30@gmail.com", "manikyashivanandappa@gmail.com"];
      const attachments = [];

      if (user.licenseCertificates) {
        user.licenseCertificates.forEach((filePath) => {
          const fileExtension = filePath.split('.').pop(); // Extract the file extension
          attachments.push({ filename: `License_Certificate.${fileExtension}`, path: filePath });
        });
      }
      if (user.boardIssuedDocuments) {
        user.boardIssuedDocuments.forEach((filePath) => {
          const fileExtension = filePath.split('.').pop(); // Extract the file extension
          attachments.push({ filename: `Board_Certificate.${fileExtension}`, path: filePath });
        });
      }
      if (user.governmentIssuedIds) {
        user.governmentIssuedIds.forEach((filePath) => {
          const fileExtension = filePath.split('.').pop(); // Extract the file extension
          attachments.push({ filename: `Government_ID.${fileExtension}`, path: filePath });
        });
      }

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: adminEmails,
        subject: "New Doctor Registration Approval Required",
        text: `Doctor ${user.firstName} ${user.lastName} has registered and is awaiting approval.
Email: ${user.email}
Specialization: ${user.specialization || "Not provided"}
Medical License Number: ${user.licenseNumber || "Not provided"}
Current Working Hospital/Clinic: ${user.currentWorkingHospital || "Not provided"}`,
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

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    console.log("👤 Login attempt details:", {
      email,
      role,
      hasPassword: !!password,
      passwordLength: password?.length
    });

    // Validate input
    if (!email || !password || !role) {
      console.log("❌ Missing fields:", {
        hasEmail: !!email,
        hasPassword: !!password,
        hasRole: !!role
      });
      return res.status(400).json({ error: "Please provide email, password and role" });
    }

    // Check if the user exists in the database
    const user = await User.findOne({ email }).select('+password'); // Explicitly select password field
    console.log("🔍 Database search result:", {
      userFound: !!user,
      userRole: user?.role,
      hasPasswordHash: !!user?.password
    });

    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // Check if the role matches
    console.log("🔍 Role check:", {
      requestedRole: role,
      userRole: user.role,
      matches: role === user.role
    });

    if (user.role !== role) {
      console.log("❌ Role mismatch for user:", email);
      return res.status(400).json({ error: "Please select the correct role for your account" });
    }

    // Validate password
    console.log("🔍 Password validation details:", {
      providedPassword: password,
      storedHash: user.password,
      passwordFieldExists: 'password' in user,
      passwordLength: user.password?.length
    });

    const isPasswordValid = await verifyPassword(password, user.password);
    console.log("🔍 Password validation result:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("❌ Invalid password for user:", email);
      return res.status(400).json({ error: "Invalid credentials" });
    }
    console.log("✅ Password validation successful");

    // Check verification status
    console.log("🔍 User verification status:", user.isVerified);
    if (!user.isVerified) {
      console.log("⚠️ Sending verification OTP to:", email);
      const { hashedOTP, otpExpiry } = await sendOTP(email);
      await OTP.updateOne(
        { email },
        {
          $set: {
            otp: hashedOTP,
            expiresAt: otpExpiry,
            attempts: 0
          }
        },
        { upsert: true }
      );

      return res.status(200).json({
        status: "unverified",
        message: "Account not verified. OTP sent to your email.",
        showOtpModal: true,
        email: email
      });
    }

    // Check doctor approval
    if (user.role === "doctor") {
      console.log("🔍 Doctor approval status:", user.isApproved);
      if (!user.isApproved) {
        console.log("⚠️ Unapproved doctor login attempt:", email);
        return res.status(403).json({
          status: "pending",
          error: "Your account is pending admin approval. Please check your email for updates."
        });
      }
    }

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRY || '24h'
  });

  console.log('User object:', user)
  // Set session
  req.session.user = {
    id: user._id.toString(), // Ensure it's a string
    email: user.email,
    role: user.role
  };

  req.session.save((err) => {
    if (err) {
      console.error("❌ Session save error:", err);
    } else {
      console.log("✅ Session saved successfully");
    }
  });

  // Set cookie with token
  res.cookie('token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production' // Use secure in production
  });

  console.log("✅ Session created:", {
    userId: req.session.user.id, // <-- This line is important
    sessionExists: !!req.session,
    userEmail: req.session.user.email, // Additional check
    token: token.substring(0, 15) + "..."
  });

    const userData = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };

    console.log("✅ Login successful:", {
      email,
      role,
      redirect: role === "patient" ? "/patient/dashboard" : "/doctors/dashboard",
    });

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      token,
      user: userData,
      redirect: role === "patient" ? "/patient/dashboard" : "/doctors/dashboard",
    });

  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({
      status: "error",
      error: "Login failed. Please try again later."
    });
  }
};


// Add this new function after the loginUser function
exports.debugResetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await User.updateOne(
      { email },
      {
        $set: {
          password: hashedPassword,
          isVerified: true // Ensure user is verified
        }
      }
    );

    console.log("✅ Password reset successful for:", email);
    res.status(200).json({ message: "Password reset successful. Please login with your new password." });
  } catch (err) {
    console.error("❌ Password Reset Error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if there's an existing OTP that hasn't expired
    const existingOTP = await OTP.findOne({ email });
    if (existingOTP && existingOTP.expiresAt > Date.now()) {
      const timeLeft = Math.ceil((existingOTP.expiresAt - Date.now()) / 1000);
      return res.status(429).json({
        error: `Please wait ${timeLeft} seconds before requesting a new OTP`
      });
    }

    // Generate and send new OTP
    const { hashedOTP, otpExpiry } = await sendOTP(email);

    // Update or create OTP record
    await OTP.updateOne(
      { email },
      {
        $set: {
          otp: hashedOTP,
          expiresAt: otpExpiry,
          attempts: 0 // Reset attempts counter
        }
      },
      { upsert: true }
    );

    console.log(`✉️ New OTP sent to ${email}`);
    res.status(200).json({
      success: true,
      message: "New OTP sent to email.",
      expiresIn: Math.ceil((otpExpiry - Date.now()) / 1000) // seconds until expiry
    });

  } catch (err) {
    console.error("❌ Resend OTP Error:", err);
    res.status(500).json({
      success: false,
      error: "Failed to resend OTP. Please try again later."
    });
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
    const { email } = req.body;

    // Find and delete user
    const result = await User.findOneAndDelete({ email });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log(`✅ User deleted: ${email}`);
    res.status(200).json({
      success: true,
      message: "User successfully deleted"
    });
  } catch (error) {
    console.error("❌ Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete user"
    });
  }
};