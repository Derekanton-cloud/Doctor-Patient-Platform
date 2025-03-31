const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

exports.authenticateUser = async (req, res, next) => {
  try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return res.status(401).json({ error: "Unauthorized: No token provided" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
          return res.status(401).json({ error: "Unauthorized: Invalid token format" });
      }

      // Verify JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id) {
          return res.status(401).json({ error: "Unauthorized: Invalid token" });
      }

      // Fetch User from Database
      const user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Attach user object to the request
      req.user = user;
      next();
  } catch (err) {
      console.error("Authentication Error:", err);

      if (err.name === "TokenExpiredError") {
          return res.status(401).json({ error: "Unauthorized: Token expired" });
      }

      res.status(401).json({ error: "Unauthorized: Invalid or missing token" });
  }
};


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
