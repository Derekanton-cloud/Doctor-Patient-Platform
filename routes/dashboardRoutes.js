const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const {
  getPatientDashboard,
  getDoctorDashboard,
  getAppointments,
} = require('../controllers/dashboardController');

// Patient Dashboard (Requires Patient Role)
router.get('/patient', authenticateUser, authorizeRole(['patient']), getPatientDashboard);

// Doctor Dashboard (Requires Doctor Role)
router.get('/doctor', authenticateUser, authorizeRole(['doctor']), getDoctorDashboard);

// Get Appointments (For both Doctor & Patient)
router.get('/appointments', authenticateUser, getAppointments);

module.exports = router;
