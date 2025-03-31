const Appointment = require("../models/appointment");
const User = require("../models/user");

// Create an Appointment (Patient)
exports.createAppointment = async (req, res) => {
  try {
    const { doctorId, date, time, reason } = req.body;
    const patientId = req.user.id; // Extracted from JWT

    // Validate doctor
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor" || !doctor.isApproved) {
      return res.status(404).json({ error: "Doctor not found or not approved" });
    }

    // Check for appointment conflicts
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date,
      time,
    });

    if (existingAppointment) {
      return res.status(409).json({ error: "Time slot already booked" });
    }

    // Create appointment
    const newAppointment = new Appointment({
      patient: patientId,
      doctor: doctorId,
      date,
      time,
      reason,
      status: "pending", // Default status
    });

    await newAppointment.save();
    res.status(201).json({
      message: "Appointment scheduled successfully",
      appointment: newAppointment,
    });
  } catch (error) {
    console.error("Appointment Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Patient Appointments
exports.getPatientAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ patient: req.user.id })
      .populate("doctor", "firstName lastName specialization")
      .sort({ date: 1 });

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Doctor Appointments
exports.getDoctorAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ doctor: req.user.id })
      .populate("patient", "firstName lastName phone")
      .sort({ date: 1 });

    res.status(200).json(appointments);
  } catch (error) {
    console.error("Fetch Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get Pending Appointments (Doctor only)
exports.getPendingAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id;
    const pendingAppointments = await Appointment.find({
      doctor: doctorId,
      status: "pending",
    }).populate("patient", "firstName lastName phone");

    res.status(200).json(pendingAppointments);
  } catch (error) {
    console.error("Fetch Pending Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update Appointment Status (Doctor only)
exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return res.status(404).json({ error: "Appointment not found" });

    // Ensure only the doctor can update the status
    if (appointment.doctor.toString() !== req.user.id || req.user.role !== "doctor") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    appointment.status = status; // pending, approved, canceled, completed
    await appointment.save();

    res.status(200).json({ message: "Appointment status updated", appointment });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
