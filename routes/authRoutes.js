const express = require("express");
const router = express.Router();
const multer = require("multer");
const authController = require("../controllers/authController");
const { authenticateUser, authorizeRole } = require("../middleware/authMiddleware");

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Authentication Routes
router.get("/check-user", authController.checkUserExists);

router.post(
  "/register",
  upload.fields([
    { name: "medicalFiles", maxCount: 5 }, // For patient medical files
    { name: "licenseCertificates", maxCount: 5 }, // For doctor license certificate
    { name: "boardIssuedDocuments", maxCount: 5 }, // For doctor board-issued document
    { name: "governmentIssuedIds", maxCount: 5 }, // For doctor photo
    { name: "governmentIssuedIdPatient", maxCount: 1 }, // For patient government-issued ID
  ]),
  authController.registerUser
);

router.post("/login", authController.loginUser);
router.post('/debug-reset-password', authController.debugResetPassword);


// OTP Routes
router.post("/verify-otp", async (req, res) => {
  try {
      const { otp, email } = req.body;
      console.log("📥 Received OTP verification request:", { email, otpLength: otp.length });

      // Call the controller with clear logging
      await authController.verifyOTP(req, res);
  } catch (error) {
      console.error("❌ OTP Verification Route Error:", error);
      res.status(500).json({
          success: false,
          message: "OTP verification failed"
      });
  }
});
router.post("/resend-otp", authController.resendOTP);

// Password Reset Routes
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// Protected Admin Routes
// Add this to your existing routes
router.delete('/delete-user', authController.deleteUser);

// View Routes
router.get("/login", (req, res) => res.render("login"));
router.get("/register", (req, res) => res.render("register"));
router.get("/admin/dashboard", (req, res) => res.render("adminDashboard"));

// Add at the end before module.exports
router.get('/debug-auth', (req, res) => {
  res.json({
      session: req.session ? {
          userId: req.session.userId,
          userRole: req.session.userRole,
          exists: true
      } : "No session",
      cookies: req.cookies || "No cookies",
      user: req.user ? {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role
      } : "No user in request",
      authenticated: !!req.user
  });
});

router.get('/logout', (req, res) => {
  try {
      // Clear the session
      req.session.destroy((err) => {
          if (err) {
              console.error("Error destroying session:", err);
              return res.status(500).send("Error logging out");
          }
          
          // Clear the authentication cookie
          res.clearCookie('token');
          
          // Redirect to login page
          console.log("✅ User logged out successfully");
          res.redirect('/login');
      });
  } catch (error) {
      console.error("Logout error:", error);
      res.status(500).send("Error logging out");
  }
});

module.exports = router;