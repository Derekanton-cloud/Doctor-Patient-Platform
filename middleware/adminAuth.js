const jwt = require('jsonwebtoken');

// Admin Authentication Middleware
const adminAuth = (req, res, next) => {
    // Check for admin session
    if (!req.session || !req.session.adminId) {
        return res.redirect('/admin/login');
    }

    try {
        // Verify JWT if present
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded.role !== 'admin') {
                return res.status(403).send('Forbidden: Admin Access Only');
            }
            req.user = decoded; // Attach user to request if token is valid
        }

        next(); // Admin is authenticated
    } catch (error) {
        console.error('Admin Auth Error:', error);
        res.status(401).send('Unauthorized: Invalid Token');
    }
};

module.exports = adminAuth;
