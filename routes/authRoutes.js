const multer = require("multer");
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateUser, authorizeRole } = require("../middleware/authMiddleware");
const User = require("../models/user");

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" }); 

// User Registration
router.post("/register", upload.fields([
  { name: "licenseCertificate1", maxCount: 1 },
  { name: "boardIssuedDocument", maxCount: 1 },
  { name: "governmentIssuedId", maxCount: 1 },
  { name: "medicalFiles", maxCount: 1 },
  { name: "governmentIssuedIdPatient", maxCount: 1 }
]), authController.registerUser);

// User Login
router.post("/login", authController.loginUser);

// Verify OTP
router.post("/verify-otp", authController.verifyOTP);

// Resend OTP
router.post("/resend-otp", authController.resendOTP);

// Serve the login page
router.get("/login", (req, res) => {
  res.render("login"); // Use res.render to render the EJS view
});

// Serve the register page
router.get("/register", (req, res) => {
  res.render("register"); // Use res.render to render the EJS view
});

// Serve the admin dashboard
router.get("/admin/dashboard", (req, res) => {
  res.render("adminDashboard"); // Use res.render to render the EJS view
});

// Delete User Route (Protected and only accessible by Admin)
router.delete("/delete-user", authenticateUser, authorizeRole(["admin"]), async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOneAndDelete({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ message: "User deleted successfully." });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

module.exports = router;
