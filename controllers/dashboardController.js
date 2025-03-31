const Appointment = require("../models/appointment");
const User = require("../models/user");

// Patient Dashboard: View Appointments
exports.getPatientDashboard = async (req, res) => {
  try {
    const patientId = req.user.id;

    // Fetch upcoming and past appointments
    const upcomingAppointments = await Appointment.find({
      patient: patientId,
      date: { $gte: new Date() },
      status: "approved",
    }).populate("doctor", "firstName lastName specialization");

    const pastAppointments = await Appointment.find({
      patient: patientId,
      date: { $lt: new Date() },
      status: "approved",
    }).populate("doctor", "firstName lastName specialization");

    res.status(200).json({ upcomingAppointments, pastAppointments });
  } catch (err) {
    console.error("Error fetching patient dashboard:", err);
    res.status(500).json({ error: "Error loading dashboard" });
  }
};

// Doctor Dashboard: View Appointments
exports.getDoctorDashboard = async (req, res) => {
  try {
    const doctorId = req.user.id;

    // Fetch pending, upcoming, and past appointments
    const pendingAppointments = await Appointment.find({
      doctor: doctorId,
      status: "pending",
    }).populate("patient", "firstName lastName email");

    const upcomingAppointments = await Appointment.find({
      doctor: doctorId,
      date: { $gte: new Date() },
      status: "approved",
    }).populate("patient", "firstName lastName email");

    const pastAppointments = await Appointment.find({
      doctor: doctorId,
      date: { $lt: new Date() },
      status: "approved",
    }).populate("patient", "firstName lastName email");

    res.status(200).json({ pendingAppointments, upcomingAppointments, pastAppointments });
  } catch (err) {
    console.error("Error fetching doctor dashboard:", err);
    res.status(500).json({ error: "Error loading dashboard" });
  }
};

// Get Appointments (For both Doctor & Patient)
exports.getAppointments = async (req, res) => {
  try {
    const userId = req.user.id;
    const appointments = await Appointment.find({
      $or: [
        { patient: userId },
        { doctor: userId }
      ]
    }).populate("patient doctor", "firstName lastName email specialization");

    res.status(200).json({ appointments });
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Error loading appointments" });
  }
};
