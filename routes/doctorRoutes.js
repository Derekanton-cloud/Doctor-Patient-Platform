const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const upload = require('../middleware/multerConfig');
const auth = require('../middleware/auth');
const Appointment = require('../models/appointment');

// Define the isDoctor middleware
const isDoctor = (req, res, next) => {
  if (req.user && req.user.role === 'doctor') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied. Doctors only.' });
};

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
// View appointments for doctor
router.get('/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patient', 'firstName lastName profileImage')
      .sort({ appointmentDate: 1 });

    res.render('doctorAppointments', { 
      user: req.user || null, // Pass null if user is not authenticated
      appointments 
    });
  } catch (error) {
    console.error('Error loading doctor appointments:', error);
    res.status(500).send('Server error');
  }
});

// Update this route to remove authentication and authorization
router.post('/appointments/:id/update', async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const { status } = req.body;

    // Validate the status
    if (!['Confirmed', 'Cancelled', 'Completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Update the appointment status
    appointment.status = status;

    // If cancelling, record cancellation details
    if (status === 'Cancelled') {
      appointment.cancellationDetails = {
        cancelledBy: 'doctor', // Assuming the doctor is cancelling
        cancelledAt: new Date(),
        reason: req.body.reason || 'No reason provided'
      };
    }

    // Save the updated appointment
    await appointment.save();

    return res.json({
      success: true,
      message: `Appointment ${status.toLowerCase()} successfully`,
      appointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    return res.status(500).json({ success: false, message: 'Error updating appointment' });
  }
});

// Add prescription to an appointment - removing authentication and authorization
router.post('/appointments/:id/prescribe', async (req, res) => {
  try {
    const { medications, notes } = req.body;

    if (!medications || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one medication is required' });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Ensure prescriptions is initialized as an array
    if (!Array.isArray(appointment.prescriptions)) {
      appointment.prescriptions = [];
    }

    // Add each medication to the prescriptions array
    medications.forEach(med => {
      appointment.prescriptions.push({
        medication: med.medication,
        dosage: med.dosage,
        frequency: med.frequency,
        duration: med.duration
      });
    });

    // Add notes if provided
    if (notes) {
      appointment.notes = notes;
    }

    await appointment.save();

    return res.status(200).json({
      success: true,
      message: 'Prescription added successfully'
    });
  } catch (error) {
    console.error('Error adding prescription:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Start video call
router.get('/appointments/:id/start-call', authenticateUser, isDoctor, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctor: req.user.id
    }).populate('patient', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).render('error', { message: 'Appointment not found' });
    }
    
    // Generate a unique meeting room ID
    const roomId = `appointment-${appointment._id}`;
    
    res.render('videoCall', {
      user: req.user,
      appointment,
      roomId,
      role: 'doctor'
    });
  } catch (error) {
    console.error('Error starting video call:', error);
    res.status(500).render('error', { message: 'Server error' });
  }
});

// Video call route
router.get('/appointments/:id/video-call', async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'firstName lastName')
      .populate('doctor', 'firstName lastName');
    
    if (!appointment) {
      return res.status(404).render('error', { message: 'Appointment not found' });
    }
    
    // Get role from query parameter
    const role = req.query.role || 'patient';
    
    res.render('videoCall', {
      user: {
        _id: req.user?._id || 'guest',
        firstName: req.user?.firstName || (role === 'doctor' ? 'Doctor' : 'Patient'),
        lastName: req.user?.lastName || 'User',
        role: role
      },
      appointment,
      role: role
    });
  } catch (error) {
    console.error('Error starting video call:', error);
    res.status(500).render('error', { message: 'Error starting video call' });
  }
});

// End call endpoint
router.post('/appointments/:id/end-call', async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    // Update appointment to completed
    if (appointment.status !== 'Completed') {
      appointment.status = 'Completed';
      await appointment.save();
    }
    
    res.json({ success: true, message: 'Call ended and appointment marked as completed' });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ success: false, message: 'Error ending call' });
  }
});

// Get doctor details by ID
router.get('/:doctorId', auth, async (req, res) => {
  try {
    const doctor = await User.findById(req.params.doctorId).select('-password');
    if (!doctor || doctor.role !== 'doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    res.render('doctorDetails', { doctor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;