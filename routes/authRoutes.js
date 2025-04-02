const express = require("express");
const router = express.Router();
const multer = require("multer");
const authController = require("../controllers/authController");
const { authenticateUser, authorizeRole } = require("../middleware/authMiddleware");

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Authentication Routes
router.post("/login", authController.loginUser);

router.get("/check-user", authController.checkUserExists);

router.post(
  "/register",
  upload.fields([
    { name: "medicalFiles", maxCount: 5 }, // For patient medical files
    { name: "licenseCertificate", maxCount: 1 }, // For doctor license certificate
    { name: "boardIssuedDocument", maxCount: 1 }, // For doctor board-issued document
    { name: "governmentIssuedId", maxCount: 1 }, // For doctor photo
    { name: "governmentIssuedIdPatient", maxCount: 1 }, // For patient government-issued ID
  ]),
  authController.registerUser
);


// OTP Routes
router.post("/verify-otp", authController.verifyOTP);
router.post("/resend-otp", authController.resendOTP);

// Password Reset Routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Protected Admin Routes
router.delete("/delete-user", authenticateUser, authorizeRole(["admin"]), authController.deleteUser);

// View Routes
router.get("/login", (req, res) => res.render("login"));
router.get("/register", (req, res) => res.render("register"));
router.get("/admin/dashboard", (req, res) => res.render("adminDashboard"));

module.exports = router;
