const multer = require('multer');
const path = require('path');
const Doctor = require('../models/doctor');
const Appointment = require('../models/appointment');
const Prescription = require('../models/prescription');
const { generateTwilioRoom } = require('../utils/videoService');
const { sendEmail } = require('../utils/emailService');

// Set up Multer storage for doctor document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Ensure the 'uploads/' directory exists
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter to allow only specific formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPEG, and PNG files are allowed'), false);
  }
};

// Upload middleware (max 5 files)
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// Export the upload middleware
exports.uploadDoctorDocuments = upload.array('documents', 5);

// Doctor Registration
exports.registerDoctor = async (req, res) => {
  try {
    const doctorData = req.body;

    // Save uploaded document paths
    if (req.files) {
      doctorData.documents = req.files.map(file => file.path);
    }

    const doctor = new Doctor(doctorData);
    await doctor.save();
    res.status(201).json({ message: 'Doctor registered successfully', doctor });
  } catch (error) {
    console.error('Error registering doctor:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Get Doctor Profile
exports.getDoctorProfile = async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    res.status(200).json(doctor);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Update Doctor Profile
exports.updateDoctorProfile = async (req, res) => {
  try {
    const updatedData = req.body;
    const doctor = await Doctor.findByIdAndUpdate(req.user.id, updatedData, { new: true });

    if (!doctor) return res.status(404).send('Doctor not found');
    res.status(200).json({ message: 'Profile updated successfully', doctor });
  } catch (error) {
    console.error('Error updating doctor profile:', error);
    res.status(500).send('Internal Server Error');
  }
};

// List Available Doctors
exports.listDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find({ isApproved: true });
    res.status(200).json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Request Appointment
exports.requestAppointment = async (req, res) => {
  try {
    const { doctorId, date } = req.body;
    const appointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      date,
      status: 'pending',
    });
    await appointment.save();
    res.status(201).json({ message: 'Appointment requested successfully', appointment });
  } catch (error) {
    console.error('Error requesting appointment:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Start Video Call (Twilio Room)
exports.startVideoCall = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).send('Appointment not found');

    const roomName = `doctor-patient-${appointmentId}`;
    const videoRoom = await generateTwilioRoom(roomName);

    appointment.videoRoom = videoRoom;
    appointment.status = 'in-progress';
    await appointment.save();

    res.status(200).json({ message: 'Video call started', roomName });
  } catch (error) {
    console.error('Error starting video call:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Create Prescription
exports.createPrescription = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { medication, dosage, notes } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).send('Appointment not found');

    const prescription = new Prescription({
      doctorId: req.user.id,
      patientId: appointment.patientId,
      medication,
      dosage,
      notes,
    });

    await prescription.save();
    appointment.status = 'completed';
    await appointment.save();

    const patient = appointment.patientId;
    await sendEmail(
      patient.email,
      'New Prescription Issued',
      `Your prescription from Dr. ${appointment.doctorId} is ready.`
    );

    res.status(200).json({ message: 'Prescription created successfully', prescription });
  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).send('Internal Server Error');
  }
};

// View Patient Prescriptions
exports.viewPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;
    const prescriptions = await Prescription.find({ doctorId: req.user.id, patientId });

    res.status(200).json(prescriptions);
  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).send('Internal Server Error');
  }
};
