const User = require('../models/user');
const Appointment = require('../models/appointment');
const Prescription = require('../models/Prescription');
const MedicalRecord = require('../models/MedicalRecord');
const Message = require('../models/Message');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Set up storage for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'public/uploads/doctors';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Define file filter for uploads
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, JPG and PDF are allowed.'), false);
  }
};

// Configure multer with the storage and fileFilter
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Dashboard controller
exports.getDashboard = async (req, res) => {
  try {
    // Debug session data
    console.log('Session data:', req.session);

    // Check if session user exists
    if (!req.session || !req.session.user) {
      return res.status(401).render('error', { message: 'Unauthorized access. Please log in.' });
    }

    const doctorId = req.session.user.id;
    if (!doctorId) {
      return res.status(401).render('error', { message: 'Invalid session. Please log in again.' });
    }

    console.log('Doctor ID:', doctorId);

    const doctor = await User.findById(doctorId);
    if (!doctor) {
      return res.status(404).render('error', { message: 'Doctor not found.' });
    }

    // Fetch dashboard data
    const appointments = await Appointment.find({ doctor: doctorId })
      .populate('patient', 'firstName lastName email profileImage')
      .sort({ appointmentDate: 1 })
      .limit(5) || [];

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const stats = {
      todayAppointments: await Appointment.countDocuments({
        doctor: doctorId,
        appointmentDate: { $gte: startOfDay, $lte: endOfDay }
      }),
      totalPatients: await User.countDocuments({
        _id: { $in: (await Appointment.distinct('patient', { doctor: doctorId })) }
      }),
      prescriptionsIssued: await Prescription.countDocuments({ doctor: doctorId }),
      completedAppointments: await Appointment.countDocuments({
        doctor: doctorId,
        status: 'Completed'
      })
    };

    const nextAppointment = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate: { $gt: new Date() },
      status: { $in: ['Confirmed', 'Pending'] }
    }).sort({ appointmentDate: 1 });

    let nextAppointmentTime = 'no upcoming appointments';
    if (nextAppointment) {
      const appointmentDate = new Date(nextAppointment.appointmentDate);
      nextAppointmentTime = formatTimeRemaining(appointmentDate);
    }

    const patientIds = await Appointment.distinct('patient', {
      doctor: doctorId,
      status: 'Completed'
    });

    const recentPatients = await Promise.all(
      patientIds.slice(0, 5).map(async (patientId) => {
        const patient = await User.findById(patientId);
        const lastAppointment = await Appointment.findOne({
          doctor: doctorId,
          patient: patientId,
          status: 'Completed'
        }).sort({ appointmentDate: -1 });

        const latestRecord = await MedicalRecord.findOne({
          patient: patientId
        }).sort({ createdAt: -1 });

        return {
          ...patient._doc,
          lastVisit: lastAppointment ? lastAppointment.appointmentDate : null,
          healthStatus: latestRecord ? latestRecord.healthStatus : 'Stable'
        };
      })
    );

    const recentRecords = await MedicalRecord.find({ doctor: doctorId })
      .populate('patient', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 })
      .limit(4);

    const recentPrescriptions = await Prescription.find({ doctor: doctorId })
      .populate('patient', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 })
      .limit(3);

    const recentMessages = await Message.find({ recipient: doctorId })
      .populate('sender', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 })
      .limit(4);

    res.render('doctorDashboard', {
      user: doctor,
      appointments,
      recentPatients,
      stats,
      nextAppointmentTime,
      recentRecords,
      recentPrescriptions,
      recentMessages
    });
  } catch (err) {
    console.error('Error in getDashboard:', err);
    res.status(500).render('error', { message: 'Server error while loading the dashboard.' });
  }
};

// Get doctor profile
exports.getDoctorProfile = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    // Get completed appointments count
    const appointmentsCount = await Appointment.countDocuments({
      doctor: doctor._id,
      status: 'Completed'
    });

    // Get years of experience (from registration date or explicitly stored)
    const yearsExperience = doctor.yearsExperience || Math.floor((new Date() - doctor.createdAt) / (1000 * 60 * 60 * 24 * 365));

    // Get ratings and reviews
    const ratings = doctor.ratings || [];
    const averageRating = ratings.length > 0
      ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length
      : 0;

    res.render('doctorProfile', {
      user: doctor,
      appointmentsCount,
      yearsExperience,
      averageRating,
      ratings
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Update doctor profile
exports.updateDoctorProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, about, education, specialty } = req.body;

    const updatedData = {
      firstName,
      lastName,
      phone,
      about,
      education,
      specialty
    };

    // If a new profile image was uploaded
    if (req.file) {
      updatedData.profileImage = `/uploads/doctors/${req.file.filename}`;
    }

    const doctor = await User.findByIdAndUpdate(
      req.session.user.id,
      updatedData,
      { new: true }
    );

    req.session.message = {
      type: 'success',
      text: 'Profile updated successfully'
    };

    res.redirect('/doctors/profile');
  } catch (err) {
    console.error(err);
    req.session.message = {
      type: 'danger',
      text: 'Error updating profile'
    };
    res.redirect('/doctors/profile');
  }
};

// Get settings page
exports.getSettings = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    res.render('doctorSettings', {
      user: doctor
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Update settings
exports.updateSettings = async (req, res) => {
  try {
    const { notificationEmail, notificationSMS, availability } = req.body;

    await User.findByIdAndUpdate(req.session.user.id, {
      settings: {
        notificationEmail,
        notificationSMS,
        availability: JSON.parse(availability)
      }
    });

    req.session.message = {
      type: 'success',
      text: 'Settings updated successfully'
    };

    res.redirect('/doctors/settings');
  } catch (err) {
    console.error(err);
    req.session.message = {
      type: 'danger',
      text: 'Error updating settings'
    };
    res.redirect('/doctors/settings');
  }
};

// Get all appointments
exports.getAppointments = async (req, res) => {
  try {
    const { filter = 'upcoming' } = req.query;
    const doctor = await User.findById(req.session.user.id);

    let query = { doctor: doctor._id };

    // Apply filters
    if (filter === 'upcoming') {
      query.appointmentDate = { $gt: new Date() };
      query.status = { $in: ['Confirmed', 'Pending'] };
    } else if (filter === 'today') {
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(today.setHours(23, 59, 59, 999));

      query.appointmentDate = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    } else if (filter === 'pending') {
      query.status = 'Pending';
    } else if (filter === 'completed') {
      query.status = 'Completed';
    } else if (filter === 'cancelled') {
      query.status = 'Cancelled';
    }

    const appointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName email profileImage')
      .sort({ appointmentDate: filter === 'completed' ? -1 : 1 });

    res.render('doctorAppointments', {
      user: doctor,
      appointments,
      filter
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get appointment details
exports.getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const appointment = await Appointment.findById(appointmentId)
      .populate('patient', 'firstName lastName email profileImage');

    if (!appointment || appointment.doctor.toString() !== doctor._id.toString()) {
      return res.status(404).render('error', { message: 'Appointment not found' });
    }

    // Get related medical records
    const medicalRecords = await MedicalRecord.find({
      patient: appointment.patient._id,
      doctor: doctor._id
    }).sort({ createdAt: -1 });

    // Get related prescriptions
    const prescriptions = await Prescription.find({
      patient: appointment.patient._id,
      doctor: doctor._id
    }).sort({ createdAt: -1 });

    res.render('appointmentDetails', {
      user: doctor,
      appointment,
      medicalRecords,
      prescriptions
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Update appointment status
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, notes } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment || appointment.doctor.toString() !== req.session.user.id) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.status = status;

    if (notes) {
      appointment.notes = notes;
    }

    await appointment.save();

    // Notify patient about status change
    // ... notification code here

    res.json({
      success: true,
      message: `Appointment ${status.toLowerCase()} successfully`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add notes to appointment
exports.addAppointmentNotes = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { notes } = req.body;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment || appointment.doctor.toString() !== req.session.user.id) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    appointment.notes = notes;
    await appointment.save();

    res.json({
      success: true,
      message: 'Notes added successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Start video call
exports.startVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment || appointment.doctor.toString() !== req.session.user.id) {
      return res.status(404).render('error', { message: 'Appointment not found' });
    }

    // Check if the appointment time is valid for video call (within 15 min buffer)
    const now = new Date();
    const appointmentTime = new Date(appointment.appointmentDate);
    const bufferEnd = new Date(appointmentTime);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + 15);

    if (now < appointmentTime || now > bufferEnd || appointment.status !== 'Confirmed') {
      return res.status(400).render('error', {
        message: 'Video call is only available at the scheduled appointment time'
      });
    }

    // Generate or retrieve video call room ID
    // For this example, we'll use a simple ID based on the appointment
    const roomId = `appointment-${appointmentId}`;

    // Mark appointment as "In Progress"
    appointment.status = 'In Progress';
    await appointment.save();

    res.render('videoCall', {
      user: await User.findById(req.session.user.id),
      appointment,
      roomId,
      role: 'doctor'
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// End video call
exports.endVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment || appointment.doctor.toString() !== req.session.user.id) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    // Update appointment status to Completed
    appointment.status = 'Completed';
    await appointment.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get patients list
exports.getPatients = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    // Find all patients that have appointments with this doctor
    const patientIds = await Appointment.distinct('patient', { doctor: doctor._id });
    const patients = await User.find({ _id: { $in: patientIds }, role: 'patient' });

    // Get additional data for each patient
    const patientsData = await Promise.all(
      patients.map(async (patient) => {
        // Get last appointment
        const lastAppointment = await Appointment.findOne({
          doctor: doctor._id,
          patient: patient._id
        }).sort({ appointmentDate: -1 });

        // Get count of appointments
        const appointmentsCount = await Appointment.countDocuments({
          doctor: doctor._id,
          patient: patient._id,
          status: 'Completed'
        });

        // Get latest medical record for health status
        const latestRecord = await MedicalRecord.findOne({
          doctor: doctor._id,
          patient: patient._id
        }).sort({ createdAt: -1 });

        return {
          ...patient._doc,
          lastVisit: lastAppointment ? lastAppointment.appointmentDate : null,
          appointmentsCount,
          healthStatus: latestRecord ? latestRecord.healthStatus : 'Stable'
        };
      })
    );

    res.render('doctorPatients', {
      user: doctor,
      patients: patientsData
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get patient details
exports.getPatientDetails = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const patient = await User.findById(patientId);

    if (!patient || patient.role !== 'patient') {
      return res.status(404).render('error', { message: 'Patient not found' });
    }

    // Check if the doctor has treated this patient
    const hasAppointment = await Appointment.exists({
      doctor: doctor._id,
      patient: patientId
    });

    if (!hasAppointment) {
      return res.status(403).render('error', {
        message: 'You do not have permission to view this patient\'s details'
      });
    }

    // Get appointments
    const appointments = await Appointment.find({
      doctor: doctor._id,
      patient: patientId
    }).sort({ appointmentDate: -1 });

    // Get medical records
    const medicalRecords = await MedicalRecord.find({
      doctor: doctor._id,
      patient: patientId
    }).sort({ createdAt: -1 });

    // Get prescriptions
    const prescriptions = await Prescription.find({
      doctor: doctor._id,
      patient: patientId
    }).sort({ createdAt: -1 });

    res.render('patientDetails', {
      user: doctor,
      patient,
      appointments,
      medicalRecords,
      prescriptions
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get medical records
exports.getMedicalRecords = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    // Get medical records created by this doctor
    const medicalRecords = await MedicalRecord.find({ doctor: doctor._id })
      .populate('patient', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 });

    res.render('doctorMedicalRecords', {
      user: doctor,
      records: medicalRecords
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get medical record details
exports.getMedicalRecordDetails = async (req, res) => {
  try {
    const { recordId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const record = await MedicalRecord.findById(recordId)
      .populate('patient', 'firstName lastName email profileImage');

    if (!record || record.doctor.toString() !== doctor._id.toString()) {
      return res.status(404).render('error', { message: 'Medical record not found' });
    }

    res.render('medicalRecordDetails', {
      user: doctor,
      record
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Create medical record form
exports.getNewMedicalRecordForm = async (req, res) => {
  try {
    const { patientId } = req.query;
    const doctor = await User.findById(req.session.user.id);

    let patient = null;
    if (patientId) {
      patient = await User.findById(patientId);

      // Check if doctor has treated this patient
      const hasAppointment = await Appointment.exists({
        doctor: doctor._id,
        patient: patientId
      });

      if (!patient || !hasAppointment) {
        return res.status(403).render('error', {
          message: 'You do not have permission to create records for this patient'
        });
      }
    }

    // Get all patients for select dropdown
    const patientIds = await Appointment.distinct('patient', { doctor: doctor._id });
    const patients = await User.find({
      _id: { $in: patientIds },
      role: 'patient'
    });

    res.render('createMedicalRecord', {
      user: doctor,
      patients,
      selectedPatient: patient
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Create medical record
exports.createMedicalRecord = async (req, res) => {
  try {
    const { patientId, recordType, diagnosis, treatment, healthStatus, notes } = req.body;

    // Check if doctor has treated this patient
    const hasAppointment = await Appointment.exists({
      doctor: req.session.user.id,
      patient: patientId
    });

    if (!hasAppointment) {
      return res.status(403).json({
        message: 'You do not have permission to create records for this patient'
      });
    }

    const newRecord = new MedicalRecord({
      doctor: req.session.user.id,
      patient: patientId,
      recordType,
      diagnosis,
      treatment,
      healthStatus,
      notes,
      summary: diagnosis.substring(0, 150)
    });

    await newRecord.save();

    req.session.message = {
      type: 'success',
      text: 'Medical record created successfully'
    };

    res.redirect(`/doctors/medicalrecords/${newRecord._id}`);
  } catch (err) {
    console.error(err);
    req.session.message = {
      type: 'danger',
      text: 'Error creating medical record'
    };
    res.redirect('/doctors/medicalrecords/new');
  }
};

// Get edit medical record form
exports.getEditMedicalRecordForm = async (req, res) => {
  try {
    const { recordId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const record = await MedicalRecord.findById(recordId)
      .populate('patient', 'firstName lastName email');

    if (!record || record.doctor.toString() !== doctor._id.toString()) {
      return res.status(404).render('error', { message: 'Medical record not found' });
    }

    res.render('editMedicalRecord', {
      user: doctor,
      record
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Update medical record
exports.updateMedicalRecord = async (req, res) => {
  try {
    const { recordId } = req.params;
    const { recordType, diagnosis, treatment, healthStatus, notes } = req.body;

    const record = await MedicalRecord.findById(recordId);

    if (!record || record.doctor.toString() !== req.session.user.id) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    record.recordType = recordType;
    record.diagnosis = diagnosis;
    record.treatment = treatment;
    record.healthStatus = healthStatus;
    record.notes = notes;
    record.summary = diagnosis.substring(0, 150);
    record.updatedAt = Date.now();

    await record.save();

    req.session.message = {
      type: 'success',
      text: 'Medical record updated successfully'
    };

    res.redirect(`/doctors/medicalrecords/${recordId}`);
  } catch (err) {
    console.error(err);
    req.session.message = {
      type: 'danger',
      text: 'Error updating medical record'
    };
    res.redirect(`/doctors/medicalrecords/edit/${req.params.recordId}`);
  }
};

// Get patient medical records
exports.getPatientMedicalRecords = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const patient = await User.findById(patientId);

    if (!patient) {
      return res.status(404).render('error', { message: 'Patient not found' });
    }

    // Check if doctor has treated this patient
    const hasAppointment = await Appointment.exists({
      doctor: doctor._id,
      patient: patientId
    });

    if (!hasAppointment) {
      return res.status(403).render('error', {
        message: 'You do not have permission to view this patient\'s records'
      });
    }

    const records = await MedicalRecord.find({
      doctor: doctor._id,
      patient: patientId
    }).sort({ createdAt: -1 });

    res.render('patientMedicalRecords', {
      user: doctor,
      patient,
      records
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get prescriptions
exports.getPrescriptions = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    // Get prescriptions created by this doctor
    const prescriptions = await Prescription.find({ doctor: doctor._id })
      .populate('patient', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 });

    res.render('doctorPrescriptions', {
      user: doctor,
      prescriptions
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get prescription details
exports.getPrescriptionDetails = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const prescription = await Prescription.findById(prescriptionId)
      .populate('patient', 'firstName lastName email profileImage');

    if (!prescription || prescription.doctor.toString() !== doctor._id.toString()) {
      return res.status(404).render('error', { message: 'Prescription not found' });
    }

    res.render('prescriptionDetails', {
      user: doctor,
      prescription
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get new prescription form
exports.getNewPrescriptionForm = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const patient = await User.findById(patientId);

    if (!patient || patient.role !== 'patient') {
      return res.status(404).render('error', { message: 'Patient not found' });
    }

    // Check if doctor has treated this patient
    const hasAppointment = await Appointment.exists({
      doctor: doctor._id,
      patient: patientId
    });

    if (!hasAppointment) {
      return res.status(403).render('error', {
        message: 'You do not have permission to create prescriptions for this patient'
      });
    }

    // Get patient's medical records for reference
    const medicalRecords = await MedicalRecord.find({
      doctor: doctor._id,
      patient: patientId
    }).sort({ createdAt: -1 });

    res.render('createPrescription', {
      user: doctor,
      patient,
      medicalRecords
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Create prescription
exports.createPrescription = async (req, res) => {
  try {
    const { patientId, diagnosis, medications, instructions, notes } = req.body;

    // Parse medications from form data
    const medsArray = Array.isArray(medications) ? medications : [medications];

    // Format medications
    const formattedMeds = medsArray.map((med, i) => ({
      name: med,
      dosage: req.body.dosages[i],
      frequency: req.body.frequencies[i]
    })).filter(med => med.name); // Filter out empty entries

    const newPrescription = new Prescription({
      doctor: req.session.user.id,
      patient: patientId,
      diagnosis,
      medications: formattedMeds,
      instructions,
      notes
    });

    await newPrescription.save();

    req.session.message = {
      type: 'success',
      text: 'Prescription created successfully'
    };

    res.redirect(`/doctors/prescriptions/${newPrescription._id}`);
  } catch (err) {
    console.error(err);
    req.session.message = {
      type: 'danger',
      text: 'Error creating prescription'
    };
    res.redirect(`/doctors/prescriptions/new/${req.body.patientId}`);
  }
};

// Get edit prescription form
exports.getEditPrescriptionForm = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const prescription = await Prescription.findById(prescriptionId)
      .populate('patient', 'firstName lastName email');

    if (!prescription || prescription.doctor.toString() !== doctor._id.toString()) {
      return res.status(404).render('error', { message: 'Prescription not found' });
    }

    res.render('editPrescription', {
      user: doctor,
      prescription
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Update prescription
exports.updatePrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const { diagnosis, medications, instructions, notes } = req.body;

    const prescription = await Prescription.findById(prescriptionId);

    if (!prescription || prescription.doctor.toString() !== req.session.user.id) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    // Parse medications from form data
    const medsArray = Array.isArray(medications) ? medications : [medications];

    // Format medications
    const formattedMeds = medsArray.map((med, i) => ({
      name: med,
      dosage: req.body.dosages[i],
      frequency: req.body.frequencies[i]
    })).filter(med => med.name); // Filter out empty entries

    prescription.diagnosis = diagnosis;
    prescription.medications = formattedMeds;
    prescription.instructions = instructions;
    prescription.notes = notes;
    prescription.updatedAt = Date.now();

    await prescription.save();

    req.session.message = {
      type: 'success',
      text: 'Prescription updated successfully'
    };

    res.redirect(`/doctors/prescriptions/${prescriptionId}`);
  } catch (err) {
    console.error(err);
    req.session.message = {
      type: 'danger',
      text: 'Error updating prescription'
    };
    res.redirect(`/doctors/prescriptions/edit/${req.params.prescriptionId}`);
  }
};

// Get patient prescriptions
exports.getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    const patient = await User.findById(patientId);

    if (!patient) {
      return res.status(404).render('error', { message: 'Patient not found' });
    }

    // Check if doctor has treated this patient
    const hasAppointment = await Appointment.exists({
      doctor: doctor._id,
      patient: patientId
    });

    if (!hasAppointment) {
      return res.status(403).render('error', {
        message: 'You do not have permission to view this patient\'s prescriptions'
      });
    }

    const prescriptions = await Prescription.find({
      doctor: doctor._id,
      patient: patientId
    }).sort({ createdAt: -1 });

    res.render('patientPrescriptions', {
      user: doctor,
      patient,
      prescriptions
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get communications
exports.getCommunications = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    // Get all messages where doctor is sender or recipient
    const sentMessages = await Message.find({ sender: doctor._id })
      .populate('recipient', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 });

    const receivedMessages = await Message.find({ recipient: doctor._id })
      .populate('sender', 'firstName lastName email profileImage')
      .sort({ createdAt: -1 });

    // Get unique conversation partners
    const conversations = {};

    // Add sent messages to conversations
    sentMessages.forEach(msg => {
      const partnerId = msg.recipient._id.toString();
      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partner: msg.recipient,
          lastMessage: msg,
          unreadCount: 0
        };
      } else if (msg.createdAt > conversations[partnerId].lastMessage.createdAt) {
        conversations[partnerId].lastMessage = msg;
      }
    });

    // Add received messages to conversations
    receivedMessages.forEach(msg => {
      const partnerId = msg.sender._id.toString();
      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partner: msg.sender,
          lastMessage: msg,
          unreadCount: msg.isRead ? 0 : 1
        };
      } else {
        if (msg.createdAt > conversations[partnerId].lastMessage.createdAt) {
          conversations[partnerId].lastMessage = msg;
        }
        if (!msg.isRead) {
          conversations[partnerId].unreadCount += 1;
        }
      }
    });

    // Convert to array and sort by most recent message
    const conversationsArray = Object.values(conversations).sort((a, b) =>
      b.lastMessage.createdAt - a.lastMessage.createdAt
    );

    res.render('doctorCommunications', {
      user: doctor,
      conversations: conversationsArray
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Get message details / conversation
exports.getMessageDetails = async (req, res) => {
  try {
    const { messageId } = req.params;
    const doctor = await User.findById(req.session.user.id);

    // Find the message
    const message = await Message.findById(messageId)
      .populate('sender', 'firstName lastName email profileImage')
      .populate('recipient', 'firstName lastName email profileImage');

    if (!message || (message.sender._id.toString() !== doctor._id.toString() &&
      message.recipient._id.toString() !== doctor._id.toString())) {
      return res.status(404).render('error', { message: 'Message not found' });
    }

    // Determine the conversation partner
    const partner = message.sender._id.toString() === doctor._id.toString() ?
      message.recipient : message.sender;

    // Get all messages in the conversation
    const conversationMessages = await Message.find({
      $or: [
        { sender: doctor._id, recipient: partner._id },
        { sender: partner._id, recipient: doctor._id }
      ]
    })
      .populate('sender', 'firstName lastName email profileImage')
      .sort({ createdAt: 1 });

    // Mark all messages from partner as read
    await Message.updateMany(
      { sender: partner._id, recipient: doctor._id, isRead: false },
      { isRead: true }
    );

    res.render('messageConversation', {
      user: doctor,
      partner,
      messages: conversationMessages
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content } = req.body;

    // Check if recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const newMessage = new Message({
      sender: req.session.user.id,
      recipient: recipientId,
      content,
      isRead: false
    });

    await newMessage.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: newMessage
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Reply to message
exports.replyToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    // Find original message
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Determine recipient (the other party in the conversation)
    const recipientId = originalMessage.sender.toString() === req.session.user.id ?
      originalMessage.recipient : originalMessage.sender;

    const newMessage = new Message({
      sender: req.session.user.id,
      recipient: recipientId,
      content,
      isRead: false
    });

    await newMessage.save();

    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      data: newMessage
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Mark message as read
exports.markMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message || message.recipient.toString() !== req.session.user.id) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.isRead = true;
    await message.save();

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get analytics
exports.getAnalytics = async (req, res) => {
  try {
    const doctor = await User.findById(req.session.user.id);

    // Get date ranges
    const today = new Date();
    const startOfToday = new Date(today.setHours(0, 0, 0, 0));
    const endOfToday = new Date(today.setHours(23, 59, 59, 999));

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Calculate statistics
    const todayAppointments = await Appointment.countDocuments({
      doctor: doctor._id,
      appointmentDate: {
        $gte: startOfToday,
        $lte: endOfToday
      }
    });

    const weekAppointments = await Appointment.countDocuments({
      doctor: doctor._id,
      appointmentDate: {
        $gte: startOfWeek
      }
    });

    const monthAppointments = await Appointment.countDocuments({
      doctor: doctor._id,
      appointmentDate: {
        $gte: startOfMonth
      }
    });

    const totalAppointments = await Appointment.countDocuments({
      doctor: doctor._id
    });

    const completedAppointments = await Appointment.countDocuments({
      doctor: doctor._id,
      status: 'Completed'
    });

    const cancelledAppointments = await Appointment.countDocuments({
      doctor: doctor._id,
      status: 'Cancelled'
    });

    const patientCount = await Appointment.distinct('patient', { doctor: doctor._id }).then(ids => ids.length);

    const prescriptionsCount = await Prescription.countDocuments({
      doctor: doctor._id
    });

    // Get appointment distribution by day of week
    const pipeline = [
      {
        $match: {
          doctor: doctor._id,
          status: 'Completed'
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$appointmentDate' }
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];

    const appointmentsByDay = await Appointment.aggregate(pipeline);

    // Format the data for charts
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayData = Array(7).fill(0);

    appointmentsByDay.forEach(day => {
      // MongoDB's $dayOfWeek returns 1 for Sunday, 2 for Monday, etc.
      const index = day._id - 1;
      dayData[index] = day.count;
    });

    res.render('doctorAnalytics', {
      user: doctor,
      stats: {
        today: todayAppointments,
        week: weekAppointments,
        month: monthAppointments,
        total: totalAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
        patients: patientCount,
        prescriptions: prescriptionsCount,
      },
      charts: {
        dayLabels: JSON.stringify(dayLabels),
        dayData: JSON.stringify(dayData)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { message: 'Server error' });
  }
};

// Helper function to format time remaining
function formatTimeRemaining(date) {
  const now = new Date();
  const diffMs = date - now;

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffMs < 0) {
    return 'past due';
  }

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} and ${diffHrs} hour${diffHrs > 1 ? 's' : ''}`;
  } else if (diffHrs > 0) {
    return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} and ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  } else {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  }
}

// Export multer middleware
exports.uploadProfileImage = upload.single('profileImage');

// Get appointments analytics
exports.getAppointmentsAnalytics = async (req, res) => {
  // Implementation for detailed appointment analytics
};

// Get patients analytics 
exports.getPatientsAnalytics = async (req, res) => {
  // Implementation for detailed patient analytics
};

// Update specialty
exports.updateSpecialty = async (req, res) => {
  // Implementation for updating specialty
};

// Update availability
exports.updateAvailability = async (req, res) => {
  // Implementation for updating availability
};

// Initiate video call
exports.initiateVideoCall = async (req, res) => {
  // Implementation for video call room creation
};

// End video call
exports.endVideoCall = async (req, res) => {
  // Implementation for ending video call
};