const Patient = require('../models/patient');
const Doctor = require('../models/doctor');
const Appointment = require('../models/appointment');
const Prescription = require('../models/prescription');
const { joinTwilioRoom } = require('../utils/videoService');
const { sendEmail } = require('../utils/emailService');
const multer = require('multer');

// Multer Setup for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/patient-documents/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

exports.uploadPatientDocuments = multer({ storage }).fields([
  { name: 'medicalFile', maxCount: 1 },
  { name: 'govtId', maxCount: 1 },
]);

// Patient Registration
exports.registerPatient = async (req, res) => {
  try {
    const { firstName, lastName, email, password, bloodGroup, medicalHistory } = req.body;

    const existingPatient = await Patient.findOne({ email });
    if (existingPatient) return res.status(400).send('Patient already exists');

    const newPatient = new Patient({
      firstName,
      lastName,
      email,
      password,
      bloodGroup,
      medicalHistory,
      medicalFile: req.files['medicalFile'] ? req.files['medicalFile'][0].path : '',
      govtId: req.files['govtId'] ? req.files['govtId'][0].path : '',
    });

    await newPatient.save();
    res.status(201).redirect('/login');
  } catch (error) {
    console.error('Error registering patient:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Get Patient Dashboard
exports.getPatientDashboard = async (req, res) => {
  try {
    const patient = await Patient.findById(req.patientId);
    if (!patient) return res.status(404).send('Patient not found');

    const approvedDoctors = await Doctor.find({ isApproved: true });

    const upcomingAppointments = await Appointment.find({
      patientId: patient._id,
      status: 'pending',
    }).populate('doctorId');

    const pastAppointments = await Appointment.find({
      patientId: patient._id,
      status: 'completed',
    }).populate('doctorId');

    res.render('patientDashboard', { patient, approvedDoctors, upcomingAppointments, pastAppointments });
  } catch (error) {
    console.error('Error loading patient dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Get Patient Profile
exports.getPatientProfile = async (req, res) => {
  try {
    const patient = await Patient.findById(req.patientId);
    if (!patient) return res.status(404).send('Patient not found');

    res.render('patientProfile', { patient });
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Update Patient Profile
exports.updatePatientProfile = async (req, res) => {
  try {
    const updatedData = req.body;
    const patient = await Patient.findByIdAndUpdate(req.patientId, updatedData, { new: true });

    if (!patient) return res.status(404).send('Patient not found');
    res.redirect('/patient/dashboard');
  } catch (error) {
    console.error('Error updating patient profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Schedule an Appointment
exports.scheduleAppointment = async (req, res) => {
  try {
    const { doctorId, date, time } = req.body;
    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isApproved) return res.status(404).send('Doctor not found');

    const appointment = new Appointment({
      patientId: req.patientId,
      doctorId,
      date,
      time,
      status: 'pending',
    });

    await appointment.save();

    // Notify Doctor
    await sendEmail(doctor.email, 'New Appointment Scheduled', 'A patient has booked an appointment with you.');

    res.redirect('/patient/dashboard');
  } catch (error) {
    console.error('Error scheduling appointment:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Join Video Call
exports.joinVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).send('Appointment not found');

    const roomName = appointment.videoRoom;
    if (!roomName) return res.status(400).send('No active video call.');

    const videoToken = await joinTwilioRoom(roomName, req.patientId);
    res.render('videoCall', { videoToken, roomName });
  } catch (error) {
    console.error('Error joining video call:', error);
    res.status(500).send('Internal Server Error');
  }
};

// View Medical History & Prescriptions
exports.viewMedicalHistory = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.patientId }).populate('doctorId');
    res.render('medicalHistory', { prescriptions });
  } catch (error) {
    console.error('Error fetching medical history:', error);
    res.status(500).send('Internal Server Error');
  }
};
