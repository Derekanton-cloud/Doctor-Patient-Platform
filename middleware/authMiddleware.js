const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

// ✅ Authorize Role Middleware (Access Control)
exports.authorizeRole = (roles) => {
  return (req, res, next) => {
    try {
      // Ensure User is Authenticated
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized: User not authenticated" });
      }

      // Ensure the User has the Correct Role
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: "Access denied: Insufficient permissions" });
      }

      // Ensure Approved Doctors Only
      if (req.user.role === "doctor" && !req.user.isApproved) {
        return res.status(403).json({ error: "Access denied: Doctor not approved yet" });
      }

      next(); // User is authorized
    } catch (err) {
      console.error("Authorization Error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
};

// ✅ Check Doctor Approval Status Middleware (For Doctor Dashboard)
exports.checkDoctorApproval = (req, res, next) => {
  if (req.user.role === "doctor" && !req.user.isApproved) {
    return res.status(403).json({
      error: "Access denied: Awaiting admin approval",
    });
  }
  next();
};

// ✅ Main Authentication Middleware (Updated with session check)
exports.authenticateUser = async (req, res, next) => {
  try {
      // Check for active session first
      if (!req.session || !req.session.userId) {
          // No session exists, redirect to login
          console.log("No active session, redirecting to login");
          return res.redirect('/login');
      }
      
      const token = req.header('Authorization')?.replace('Bearer ', '') || 
                   req.cookies.token;

      if (!token) {
          return res.status(401).redirect('/login');
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
          return res.status(401).redirect('/login');
      }

      req.user = user;
      next();
  } catch (error) {
      console.error('Auth Error:', error);
      res.status(401).redirect('/login');
  }
};