const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const path = require("path");


// Admin Login
router.get('/dashboard', (req, res) => res.render('adminDashboard'));


// Doctor Approval Dashboard
router.get('/pending-doctors', authenticateUser, authorizeRole(['admin']), adminController.getPendingDoctors);
router.post('/approve-doctor/:id', authenticateUser, authorizeRole(['admin']), adminController.approveDoctor);
router.post('/reject-doctor/:id', authenticateUser, authorizeRole(['admin']), adminController.rejectDoctor);

module.exports = router;
