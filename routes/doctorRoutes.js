const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const {
  uploadDoctorDocuments,
  registerDoctor,
  getDoctorProfile,
  updateDoctorProfile,
  listDoctors,
  requestAppointment,
  startVideoCall,
  createPrescription,
  viewPatientPrescriptions,
} = require('../controllers/doctorController');

// Doctor Registration (with file uploads)
router.post('/register', uploadDoctorDocuments, registerDoctor);

// Get Doctor Profile (Authenticated Doctor Only)
router.get('/profile', authenticateUser, authorizeRole(['doctor']), getDoctorProfile);

// Update Doctor Profile
router.put('/profile', authenticateUser, authorizeRole(['doctor']), updateDoctorProfile);

// List Available Doctors (For Patients)
router.get('/list', authenticateUser, listDoctors);

// Request Appointment (Patients only)
router.post('/appointments/request', authenticateUser, authorizeRole(['patient']), requestAppointment);

// Start Video Call (Doctors only)
router.get('/appointments/:appointmentId/start-call', authenticateUser, authorizeRole(['doctor']), startVideoCall);

// Create Prescription (Doctors only)
router.post('/appointments/:appointmentId/prescribe', authenticateUser, authorizeRole(['doctor']), createPrescription);

// View Patient Prescriptions (Doctors only)
router.get('/patients/:patientId/prescriptions', authenticateUser, authorizeRole(['doctor']), viewPatientPrescriptions);

module.exports = router;
