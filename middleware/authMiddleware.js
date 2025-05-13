const jwt = require("jsonwebtoken");
const User = require("../models/user");
require("dotenv").config();

// Authentication middleware - log real details and be more permissive
exports.authenticateUser = async (req, res, next) => {
  try {
    console.log("AUTH MIDDLEWARE CHECK:", {
      session: !!req.session,
      sessionUser: req.session?.user ? true : false,
      userId: req.session?.user?.id,
      userRole: req.session?.user?.role,
    });

    // First check if user is in session
    if (req.session && req.session.user && req.session.user.id) {
      console.log("✅ User authenticated via session:", req.session.user);
      return next();
    }

    // Then try token-based auth as fallback
    const token =
      req.cookies.token ||
      (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : null);

    console.log("Token from cookies or headers:", token);

    if (!token) {
      console.log("❌ No auth token or session found");

      // Check if this is an AJAX request
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf("json") > -1)) {
        return res.status(401).json({ error: "Unauthorized: User not authenticated" });
      } else {
        // For regular requests, redirect to login
        return res.redirect("/login");
      }
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        console.log("❌ User not found with token ID");
        if (req.xhr || (req.headers.accept && req.headers.accept.indexOf("json") > -1)) {
          return res.status(401).json({ error: "Unauthorized: User not authenticated" });
        } else {
          return res.redirect("/login");
        }
      }

      // Add user to request
      req.user = user;

      // Set session if it doesn't exist
      if (!req.session.user) {
        req.session.user = {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
        };
        console.log("✅ Session created from token:", req.session.user);
      }

      next();
    } catch (error) {
      console.log("❌ Token validation failed:", error.message);
      if (req.xhr || (req.headers.accept && req.headers.accept.indexOf("json") > -1)) {
        return res.status(401).json({ error: "Unauthorized: User not authenticated" });
      } else {
        return res.redirect("/login");
      }
    }
  } catch (error) {
    console.error("AUTH MIDDLEWARE ERROR:", error);
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf("json") > -1)) {
      return res.status(401).json({ error: "Unauthorized: User not authenticated" });
    } else {
      return res.redirect("/login");
    }
  }
};

// Role-based authorization
exports.authorizeRole = (roles) => {
  return (req, res, next) => {
    console.log("ROLE CHECK:", {
      userRole: req.session?.user?.role,
      allowedRoles: roles
    });

    if (!req.session || !req.session.user || !req.session.user.role) {
      console.log('❌ No user or role in session');
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }
    
    const userRole = req.session.user.role;
    
    if (!roles.includes(userRole)) {
      console.log(`❌ Role mismatch: User has ${userRole}, needs one of ${roles.join(', ')}`);
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    console.log('✅ Role authorization successful');
    next();
  };
};

// Legacy version for backward compatibility
exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    console.log("ROLE CHECK (legacy):", {
      userRole: req.session?.user?.role,
      allowedRoles: roles
    });

    if (!req.session || !req.session.user || !req.session.user.role) {
      console.log('❌ No user or role in session');
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }
    
    const userRole = req.session.user.role;
    
    if (!roles.includes(userRole)) {
      console.log(`❌ Role mismatch: User has ${userRole}, needs one of ${roles.join(', ')}`);
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    console.log('✅ Role authorization successful');
    next();
  };
};

// Check Doctor Approval Status Middleware (For Doctor Dashboard)
exports.checkDoctorApproval = (req, res, next) => {
  if (req.user && req.user.role === "doctor" && !req.user.isApproved) {
    console.log('❌ Doctor not approved:', req.user.email);
    return res.status(403).json({
      error: "Access denied: Awaiting admin approval",
    });
  }
  next();
};