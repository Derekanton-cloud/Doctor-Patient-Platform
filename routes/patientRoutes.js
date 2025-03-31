const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const {
  registerPatient,
  getPatientDashboard,
  getPatientProfile,
  updatePatientProfile,
  uploadPatientDocuments,
  scheduleAppointment,
  joinVideoCall,
  viewMedicalHistory,
} = require('../controllers/patientController');

// Patient Registration (with file uploads)
router.post('/register', uploadPatientDocuments, registerPatient);

// Patient Dashboard (Authenticated Patient Only)
router.get('/dashboard', authenticateUser, authorizeRole(['patient']), getPatientDashboard);

// Get Patient Profile
router.get('/profile', authenticateUser, authorizeRole(['patient']), getPatientProfile);

// Update Patient Profile
router.put('/profile', authenticateUser, authorizeRole(['patient']), updatePatientProfile);

// Schedule Appointment
router.post('/appointment', authenticateUser, authorizeRole(['patient']), scheduleAppointment);

// Join Video Call
router.get('/appointment/:appointmentId/video', authenticateUser, authorizeRole(['patient']), joinVideoCall);

// View Medical History
router.get('/medical-history', authenticateUser, authorizeRole(['patient']), viewMedicalHistory);

module.exports = router;
