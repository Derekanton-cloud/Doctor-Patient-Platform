const express = require("express");
const router = express.Router();
const {
  createAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  getPendingAppointments,
  updateAppointmentStatus,
} = require("../controllers/appointmentController");
const { authenticateUser, authorizeRole } = require("../middleware/authMiddleware");

// Patient: Schedule an appointment
router.post("/", authenticateUser, authorizeRole("patient"), createAppointment);

// Patient: View appointment history
router.get("/patient", authenticateUser, authorizeRole("patient"), getPatientAppointments);

// Doctor: View all their appointments
router.get("/doctor", authenticateUser, authorizeRole("doctor"), getDoctorAppointments);

// Doctor: View pending appointments
router.get("/pending", authenticateUser, authorizeRole("doctor"), getPendingAppointments);

// Doctor: Approve or reject an appointment
router.patch(
  "/status/:appointmentId",
  authenticateUser,
  authorizeRole("doctor"),
  updateAppointmentStatus
);

module.exports = router;
