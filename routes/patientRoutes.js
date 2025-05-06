const express = require('express');
const router = express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage });

// Middleware to check if user is a patient
const isPatient = (req, res, next) => {
    if (req.user && req.user.role === 'patient') {
        next();
    } else {
        res.status(403).redirect('/login');
    }
};

// Patient Dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
      console.log("Accessing /patient/dashboard with user:", req.user.email);
      
      // Fetch all approved doctors
      const doctors = await User.find({
          role: 'doctor',
          isVerified: true,
          isApproved: true
      }).select('firstName lastName specialization currentWorkingHospital profileImage');

      res.render('patientDashboard', {
          user: req.user,
          doctors
      });
  } catch (error) {
      console.error('Error loading patient dashboard:', error);
      res.status(500).send('Server error');
  }
});

// View specific doctor details
router.get('/doctor/:id', authenticateUser, isPatient, async (req, res) => {
    try {
        const doctor = await User.findOne({
            _id: req.params.id,
            role: 'doctor',
            isVerified: true,
            isApproved: true
        });

        if (!doctor) {
            return res.status(404).send('Doctor not found');
        }

        res.render('doctorDetails', { 
            doctor, 
            user: req.user 
        });
    } catch (error) {
        console.error('Error loading doctor details:', error);
        res.status(500).send('Server error');
    }
});

// Patient Profile - View patient's own profile
router.get('/profile', authenticateUser, isPatient, async (req, res) => {
    try {
        res.render('patientProfile', { 
            user: req.user 
        });
    } catch (error) {
        console.error('Error loading patient profile:', error);
        res.status(500).send('Server error');
    }
});

// Update Patient Profile
router.post('/profile/update', authenticateUser, isPatient, upload.single('profileImage'), async (req, res) => {
    try {
        const { firstName, lastName, phone, emergencyContact } = req.body;
        
        const updateData = { firstName, lastName, phone, emergencyContact };
        
        // If profile image uploaded
        if (req.file) {
            updateData.profileImage = req.file.path;
        }
        
        await User.findByIdAndUpdate(req.user.id, updateData);
        
        res.redirect('/patient/profile');
    } catch (error) {
        console.error('Error updating patient profile:', error);
        res.status(500).send('Server error');
    }
});

// My Appointments - View patient's appointments
router.get('/appointments', authenticateUser, isPatient, async (req, res) => {
    try {
        // This route will require your Appointment model
        // const appointments = await Appointment.find({ patient: req.user.id })
        //     .populate('doctor', 'firstName lastName specialization');
        
        res.render('patientAppointments', { 
            user: req.user,
            // appointments 
        });
    } catch (error) {
        console.error('Error loading patient appointments:', error);
        res.status(500).send('Server error');
    }
});

// Schedule Appointment with a Doctor
router.post('/schedule-appointment', authenticateUser, isPatient, async (req, res) => {
    try {
        const { doctorId, date, time, reason } = req.body;
        
        // This route will require your Appointment model
        // const appointment = new Appointment({
        //     patient: req.user.id,
        //     doctor: doctorId,
        //     dateTime: new Date(`${date}T${time}`),
        //     reason,
        //     status: 'pending'
        // });
        
        // await appointment.save();
        
        res.redirect('/patient/appointments');
    } catch (error) {
        console.error('Error scheduling appointment:', error);
        res.status(500).send('Server error');
    }
});

// Join Video Call for an Appointment
router.get('/video/:appointmentId', authenticateUser, isPatient, async (req, res) => {
    try {
        // This route will require your Appointment model
        // const appointment = await Appointment.findOne({
        //     _id: req.params.appointmentId,
        //     patient: req.user.id,
        //     status: 'confirmed'
        // });
        
        // if (!appointment) {
        //     return res.status(404).send('Appointment not found or not confirmed');
        // }
        
        res.render('videoCall', { 
            user: req.user,
            // appointment 
        });
    } catch (error) {
        console.error('Error joining video call:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;