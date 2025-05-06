const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
    try {
        // Get token from various sources
        let token = null;
        
        // 1. Check for token in headers
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
            console.log("Token from Auth header:", token.substring(0, 15) + "...");
        } 
        // 2. Check for token in cookies
        else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
            console.log("Token from cookies:", token.substring(0, 15) + "...");
        }
        // 3. Check for session user ID
        else if (req.session && req.session.userId) {
            console.log("Using session userId:", req.session.userId);
            const user = await User.findById(req.session.userId);
            if (user) {
                req.user = user;
                console.log("User authenticated via session:", user.email);
                return next();
            }
        }

        // If no token and no session, redirect to login
        if (!token) {
            console.log("No token or session found, redirecting to login");
            return res.redirect('/login');
        }

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Token decoded successfully:", decoded);

        // Find the user
        const user = await User.findById(decoded.id);
        
        if (!user) {
            console.log("User not found for token");
            return res.redirect('/login');
        }

        // Set user on request object
        req.user = user;
        console.log("User authenticated via token:", user.email);
        next();
    } catch (error) {
        console.error('Auth Error:', error);
        res.redirect('/login');
    }
};