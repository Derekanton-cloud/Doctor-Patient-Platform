const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/multerConfig');

// Add this to your doctorRoutes.js before all other routes
router.get('/auth-test', authenticateUser, (req, res) => {
    res.send(`
      <h1>Authentication Test Successful</h1>
      <p><strong>User ID:</strong> ${req.session.user.id}</p>
      <p><strong>Email:</strong> ${req.session.user.email}</p>
      <p><strong>Role:</strong> ${req.session.user.role}</p>
      <p><a href="/doctors/dashboard">Go to Dashboard</a></p>
    `);
  });

// Dashboard routes
router.get('/dashboard', authenticateUser, authorizeRole(['doctor']), doctorController.getDashboard);
router.get('/profile', authenticateUser, authorizeRole(['doctor']), doctorController.getDoctorProfile);
router.get('/settings', authenticateUser, authorizeRole(['doctor']), doctorController.getSettings);

// Appointment management
router.get('/appointments', authenticateUser, authorizeRole(['doctor']), doctorController.getAppointments);
router.get('/appointments/:appointmentId', authenticateUser, authorizeRole(['doctor']), doctorController.getAppointmentDetails);
router.put('/appointments/:appointmentId', authenticateUser, authorizeRole(['doctor']), doctorController.updateAppointmentStatus);
router.post('/appointments/:appointmentId/notes', authenticateUser, authorizeRole(['doctor']), doctorController.addAppointmentNotes);
router.get('/appointments/:appointmentId/start-call', authenticateUser, authorizeRole(['doctor']), doctorController.startVideoCall);

// Patient management
router.get('/patients', authenticateUser, authorizeRole(['doctor']), doctorController.getPatients);
router.get('/patients/:patientId', authenticateUser, authorizeRole(['doctor']), doctorController.getPatientDetails);

// Medical records management
router.get('/medicalrecords', authenticateUser, authorizeRole(['doctor']), doctorController.getMedicalRecords);
router.get('/medicalrecords/:recordId', authenticateUser, authorizeRole(['doctor']), doctorController.getMedicalRecordDetails);
router.post('/medicalrecords/new', authenticateUser, authorizeRole(['doctor']), doctorController.createMedicalRecord);
router.get('/medicalrecords/edit/:recordId', authenticateUser, authorizeRole(['doctor']), doctorController.getEditMedicalRecordForm);
router.put('/medicalrecords/:recordId', authenticateUser, authorizeRole(['doctor']), doctorController.updateMedicalRecord);
router.get('/medicalrecords/:patientId', authenticateUser, authorizeRole(['doctor']), doctorController.getPatientMedicalRecords);

// Prescription management
router.get('/prescriptions', authenticateUser, authorizeRole(['doctor']), doctorController.getPrescriptions);
router.get('/prescriptions/:prescriptionId', authenticateUser, authorizeRole(['doctor']), doctorController.getPrescriptionDetails);
router.get('/prescriptions/new/:patientId', authenticateUser, authorizeRole(['doctor']), doctorController.getNewPrescriptionForm);
router.post('/prescriptions/new', authenticateUser, authorizeRole(['doctor']), doctorController.createPrescription);
router.get('/prescriptions/edit/:prescriptionId', authenticateUser, authorizeRole(['doctor']), doctorController.getEditPrescriptionForm);
router.put('/prescriptions/:prescriptionId', authenticateUser, authorizeRole(['doctor']), doctorController.updatePrescription);
router.get('/patients/:patientId/prescriptions', authenticateUser, authorizeRole(['doctor']), doctorController.getPatientPrescriptions);

// Communication and messaging
router.get('/communications', authenticateUser, authorizeRole(['doctor']), doctorController.getCommunications);
router.get('/communications/:messageId', authenticateUser, authorizeRole(['doctor']), doctorController.getMessageDetails);
router.post('/communications/send', authenticateUser, authorizeRole(['doctor']), doctorController.sendMessage);
router.post('/communications/:messageId/reply', authenticateUser, authorizeRole(['doctor']), doctorController.replyToMessage);
router.put('/communications/:messageId/read', authenticateUser, authorizeRole(['doctor']), doctorController.markMessageAsRead);

// Analytics and reporting
router.get('/analytics', authenticateUser, authorizeRole(['doctor']), doctorController.getAnalytics);
router.get('/analytics/appointments', authenticateUser, authorizeRole(['doctor']), doctorController.getAppointmentsAnalytics);
router.get('/analytics/patients', authenticateUser, authorizeRole(['doctor']), doctorController.getPatientsAnalytics);

// Profile management
router.put('/profile/update', authenticateUser, authorizeRole(['doctor']), upload.single('profileImage'), doctorController.updateDoctorProfile);
router.put('/profile/update-specialty', authenticateUser, authorizeRole(['doctor']), doctorController.updateSpecialty);
router.put('/profile/availability', authenticateUser, authorizeRole(['doctor']), doctorController.updateAvailability);

// Doctor registration (handled by auth routes, included here for reference)
// router.post('/register', upload.fields([
//   { name: 'profileImage', maxCount: 1 },
//   { name: 'certifications', maxCount: 5 },
//   { name: 'licenseDocument', maxCount: 1 }
// ]), doctorController.registerDoctor);

// Video calling feature
router.get('/video-call/:appointmentId', authenticateUser, authorizeRole(['doctor']), doctorController.initiateVideoCall);
router.post('/video-call/:appointmentId/end', authenticateUser, authorizeRole(['doctor']), doctorController.endVideoCall);

module.exports = router;