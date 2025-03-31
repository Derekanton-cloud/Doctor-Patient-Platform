const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Test route to send OTP
router.post("/send-test-otp", authController.sendTestOTP);

module.exports = router;
