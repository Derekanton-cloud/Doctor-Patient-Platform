const express = require('express');
const router = express.Router();
const User = require('../models/user');
const auth = require('../middleware/auth');
const { authenticateUser, authorizeRole } = require('../middleware/authMiddleware');
const multer = require('multer');
const DoctorAvailability = require('../models/availability');
const Appointment = require('../models/appointment');

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
// View specific doctor details - Update this route to make it publicly accessible
router.get('/doctor/:id', async (req, res) => {
    try {
        const doctor = await User.findOne({
            _id: req.params.id,
            role: 'doctor',
            isVerified: true,
            isApproved: true,
        });

        if (!doctor) {
            return res.status(404).render('error', {
                message: 'Doctor not found',
                user: req.user || null
            });
        }

        // Fetch doctor's availability slots
        const availability = await DoctorAvailability.findOne({ doctor: doctor._id });

        // Create a plain object from the doctor Mongoose document
        const doctorObj = doctor.toObject();

        // Add availability data to the doctor object before sending to template
        const doctorWithAvailability = {
            ...doctorObj,
            availableSlots: availability ? availability.availableSlots : [],
            isOnLeave: availability ? availability.isOnLeave : false,
            leaveStartDate: availability ? availability.leaveStartDate : null,
            leaveEndDate: availability ? availability.leaveEndDate : null
        };

        console.log('Doctor details:', doctor);
        console.log('Availability slots:', doctorWithAvailability.availableSlots);

        // Pass message and type from query parameters
        const { message, type } = req.query;

        res.render('doctorDetails', {
            doctor: doctorWithAvailability,
            user: req.user || null,
            message: message || null,
            type: type || null
        });
    } catch (error) {
        console.error('Error loading doctor details:', error);
        res.status(500).render('error', {
            message: 'An error occurred while loading doctor details',
            user: req.user || null
        });
    }
});
/*
router.get('/doctor/:id', async (req, res) => {
  try {
    const doctor = await User.findOne({
      _id: req.params.id,
      role: 'doctor',
      isVerified: true,
      isApproved: true,
    });

    if (!doctor) {
      console.log('Doctor not found.');
      return res.status(404).render('error', { message: 'Doctor not found' });
    }

    // Fetch doctor's availability slots
    const availability = await DoctorAvailability.findOne({ doctor: doctor._id });
    
    // Add availability data to the doctor object before sending to template
    const doctorWithAvailability = {
      ...doctor._doc,
      availableSlots: availability ? availability.availableSlots : [],
      isOnLeave: availability ? availability.isOnLeave : false,
      leaveStartDate: availability ? availability.leaveStartDate : null,
      leaveEndDate: availability ? availability.leaveEndDate : null
    };

    console.log('Doctor details:', doctor);
    console.log('Availability slots:', doctorWithAvailability.availableSlots);
    console.log('Rendering doctorDetails.ejs...');
    
    // Pass the user if they're logged in, otherwise pass null
    const user = req.user || null;
    res.render('doctorDetails', { 
      doctor: doctorWithAvailability,
      user: user
    });
  } catch (error) {
    console.error('Error loading doctor details:', error);
    res.status(500).render('error', { 
      message: 'An error occurred while loading doctor details',
      user: req.user || null
    });
  }
});
*/

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
router.get('/appointments', async (req, res) => {
    try {
        const appointments = req.user
            ? await Appointment.find({ patient: req.user.id })
                .populate('doctor', 'firstName lastName specialization profileImage')
                .sort({ appointmentDate: 1 })
            : []; // Return an empty array if user is not authenticated

        res.render('patientAppointments', {
            user: req.user || null,
            appointments
        });
    } catch (error) {
        console.error('Error loading patient appointments:', error);
        res.status(500).send('Server error');
    }
});

// Schedule Appointment with a Doctor
router.post('/schedule-appointment', async (req, res) => {
    try {
        const { doctorId, date, time, reason } = req.body;
        
        // Additional fields for guest booking
        const { guestName, guestEmail, guestPhone } = req.body;

        // Validate input
        if (!doctorId || !date || !time || !reason) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Create appointment datetime by combining date and time
        const appointmentDateTime = new Date(`${date}T${time}`);

        // Check if doctor exists and is approved
        const doctor = await User.findOne({
            _id: doctorId,
            role: 'doctor',
            isVerified: true,
            isApproved: true
        });

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found or not approved' });
        }

        // Check if the time slot is already booked
        const existingAppointment = await Appointment.findOne({
            doctor: doctorId,
            appointmentDate: appointmentDateTime,
            status: { $ne: 'Cancelled' }
        });

        if (existingAppointment) {
            return res.status(400).json({ success: false, message: 'This time slot is already booked' });
        }

        // Create appointment object
        const appointmentData = {
            doctor: doctorId,
            appointmentDate: appointmentDateTime,
            reason,
            status: 'Pending'
        };

        // Add patient ID if user is logged in, otherwise add guest information
        if (req.user) {
            appointmentData.patient = req.user.id;
            appointmentData.isGuestBooking = false;
        } else {
            // For guest bookings, don't set patient field, but store guest information
            appointmentData.isGuestBooking = true;
            appointmentData.guestInformation = {
                name: guestName || 'Guest User',
                email: guestEmail || 'guest@example.com',
                phone: guestPhone || '0000000000'
            };
        }

        // Create new appointment
        const appointment = new Appointment(appointmentData);
        await appointment.save();

        // Redirect appropriately
        if (req.user) {
            res.redirect(`/patient/appointments?message=Appointment booked successfully&type=success`);
        } else {
            res.render('appointmentConfirmation', {
                message: 'Your appointment request has been received',
                appointmentData: {
                    doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
                    date: appointmentDateTime.toLocaleDateString(),
                    time: appointmentDateTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
                    reason: reason
                }
            });
        }
    } catch (error) {
        console.error('Error scheduling appointment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
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

router.post('/appointments/:id/cancel', authenticateUser, isPatient, async (req, res) => {
    try {
        const appointment = await Appointment.findOne({
            _id: req.params.id,
            patient: req.user.id
        });

        if (!appointment) {
            return res.status(404).json({ success: false, message: 'Appointment not found' });
        }

        // Only allow cancellation of pending or confirmed appointments
        if (['Pending', 'Confirmed'].includes(appointment.status)) {
            appointment.status = 'Cancelled';
            await appointment.save();

            return res.status(200).json({ success: true, message: 'Appointment cancelled successfully' });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Cannot cancel a completed or already cancelled appointment'
            });
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;