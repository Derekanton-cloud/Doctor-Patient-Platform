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
    if (!['Confirmed', 'Cancelled'].includes(status)) {
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

// Add prescription to an appointment
router.post('/appointments/:id/prescribe', authenticateUser, isDoctor, async (req, res) => {
  try {
    const { medication, dosage, frequency, duration, notes } = req.body;
    
    const appointment = await Appointment.findOne({ 
      _id: req.params.id,
      doctor: req.user.id
    });
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    // Add prescription
    appointment.prescriptions.push({
      medication,
      dosage,
      frequency,
      duration,
      notes
    });
    
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

// End video call
router.post('/appointments/:id/end-call', authenticateUser, isDoctor, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      doctor: req.user.id
    });
    
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    // Update appointment status to Completed
    appointment.status = 'Completed';
    await appointment.save();
    
    return res.status(200).json({
      success: true,
      message: 'Video call ended and appointment marked as completed'
    });
  } catch (error) {
    console.error('Error ending video call:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

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

// Video calling feature
router.post('/video-call/:appointmentId/end', authenticateUser, isDoctor, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.appointmentId);
    
    if (!appointment || appointment.doctor.toString() !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    
    // Update appointment status to Completed
    appointment.status = 'Completed';
    await appointment.save();
    
    res.json({ success: true, message: 'Call ended successfully' });
  } catch (error) {
    console.error('Error ending video call:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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

// Book an appointment
router.post('/:doctorId/book-appointment', async (req, res) => {
  try {
    const { date, time, reason } = req.body;
    
    // Combine date and time into a single datetime
    const appointmentDateTime = new Date(`${date}T${time}`);
    
    const appointment = new Appointment({
      patient: req.user._id,
      doctor: req.params.doctorId,
      appointmentDate: appointmentDateTime,
      reason,
      status: 'Pending',
    });

    await appointment.save();

    res.status(200).json({ 
      success: true, 
      message: 'Appointment booked successfully. Awaiting doctor confirmation.' 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Fix the /dashboard/counts route to allow access without authentication or authorization
router.get('/dashboard/counts', async (req, res) => {
  try {
    const doctorId = req.query.doctorId; // Accept doctorId as a query parameter
    const currentDate = new Date();

    if (!doctorId) {
      return res.status(400).json({ success: false, message: 'Doctor ID is required' });
    }

    // Get start and end of today
    const startOfDay = new Date(currentDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(currentDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Calculate today's appointments
    const todayAppointments = await Appointment.countDocuments({
      doctor: doctorId,
      appointmentDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: { $nin: ['Cancelled'] }
    });

    // Calculate total patients (unique patients who have had appointments with this doctor)
    const totalPatients = await Appointment.distinct('patient', {
      doctor: doctorId,
      patient: { $exists: true, $ne: null }
    }).then(patients => patients.length);

    // Calculate total prescriptions issued
    const totalPrescriptions = await Appointment.aggregate([
      { $match: { doctor: doctorId } },
      { $project: { prescriptionCount: { $size: { $ifNull: ["$prescriptions", []] } } } },
      { $group: { _id: null, total: { $sum: "$prescriptionCount" } } }
    ]);

    const prescriptionsIssued = totalPrescriptions.length > 0 ? totalPrescriptions[0].total : 0;

    // Calculate completed sessions
    const completedSessions = await Appointment.countDocuments({
      doctor: doctorId,
      status: 'Completed'
    });

    // Return the updated counts
    return res.json({
      success: true,
      counts: {
        todayAppointments,
        totalPatients,
        prescriptionsIssued,
        completedSessions
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard counts:', error);
    return res.status(500).json({ success: false, message: 'Error updating dashboard counts' });
  }
});

// API route to fetch appointments for any user (no authentication or authorization required)
router.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate('patient', 'firstName lastName profileImage')
      .sort({ appointmentDate: 1 });

    res.json({ success: true, appointments });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ success: false, message: 'Error fetching appointments' });
  }
});

module.exports = router;