const express = require('express');
const router = express.Router();
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const {
  createPrescription,
  getPrescriptionById,
  getPrescriptionsByDoctor,
  getPrescriptionsByPatient,
  updatePrescription,
  deletePrescription,
} = require('../controllers/prescriptionController');

// Create Prescription (Doctors only)
router.post('/', authenticateUser, authorizeRole(['doctor']), createPrescription);

// Get Prescription by ID (Doctor and Patient)
router.get('/:prescriptionId', authenticateUser, getPrescriptionById);

// Get Prescriptions by Doctor (Doctors only)
router.get('/doctor/all', authenticateUser, authorizeRole(['doctor']), getPrescriptionsByDoctor);

// Get Prescriptions by Patient (Patients only)
router.get('/patient/all', authenticateUser, authorizeRole(['patient']), getPrescriptionsByPatient);

// Update Prescription (Doctors only)
router.put('/:prescriptionId', authenticateUser, authorizeRole(['doctor']), updatePrescription);

// Delete Prescription (Doctors only)
router.delete('/:prescriptionId', authenticateUser, authorizeRole(['doctor']), deletePrescription);

module.exports = router;
