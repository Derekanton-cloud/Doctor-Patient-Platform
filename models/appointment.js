const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Changed to false to support guest bookings
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Guest booking fields
  isGuestBooking: {
    type: Boolean,
    default: false
  },
  guestInformation: {
    name: String,
    email: String,
    phone: String
  },
  appointmentDate: { 
    type: Date, 
    required: true 
  },
  appointmentType: { 
    type: String, 
    enum: ['General Consultation', 'Follow-up', 'Specialist Consultation', 'Emergency'],
    default: 'General Consultation'
  },
  reason: { 
    type: String, 
    required: true 
  },
  symptoms: [{ 
    type: String 
  }],
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'No Show', 'In Progress'],
    default: 'Pending',
  },
  notes: { 
    type: String 
  },
  videoRoom: { 
    type: String 
  },
  isVirtual: { 
    type: Boolean, 
    default: true 
  },
  duration: { 
    type: Number, 
    default: 30 // Duration in minutes
  },
  reminders: [{
    sentAt: Date,
    method: {
      type: String,
      enum: ['Email', 'SMS'],
    }
  }],
  cancellationReason: { 
    type: String 
  },
  cancelledBy: {
    type: String,
    enum: ['doctor', 'patient']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  prescriptions: {
    type: [
      {
        medication: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        notes: { type: String }
      }
    ],
    default: [] // Initialize prescriptions as an empty array by default
  },
}, { timestamps: true });

// Index for better performance on common queries
appointmentSchema.index({ doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: 1 });
appointmentSchema.index({ status: 1 });

// Virtual for formatting the appointment time
appointmentSchema.virtual('formattedTime').get(function() {
  return this.appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
});

// Virtual for formatting the appointment date
appointmentSchema.virtual('formattedDate').get(function() {
  return this.appointmentDate.toLocaleDateString();
});

// Method to check if the appointment is active (within the scheduled time + buffer)
appointmentSchema.methods.isActive = function() {
  const now = new Date();
  const appointmentTime = this.appointmentDate;
  const bufferEnd = new Date(appointmentTime);
  bufferEnd.setMinutes(bufferEnd.getMinutes() + 15);
  
  return (now >= appointmentTime && now <= bufferEnd && this.status === 'Confirmed');
};

// Method to check if appointment can be cancelled (e.g., not within 24h)
appointmentSchema.methods.canBeCancelled = function() {
  const now = new Date();
  const appointmentTime = this.appointmentDate;
  const diff = appointmentTime - now;
  const hoursDiff = diff / (1000 * 60 * 60);
  
  return (hoursDiff > 24 && this.status !== 'Completed' && this.status !== 'Cancelled');
};

// Static method to find upcoming appointments for a doctor
appointmentSchema.statics.findUpcomingForDoctor = function(doctorId) {
  return this.find({
    doctor: doctorId,
    appointmentDate: { $gt: new Date() },
    status: { $in: ['Confirmed', 'Pending'] }
  }).populate('patient', 'firstName lastName email profileImage')
    .sort({ appointmentDate: 1 });
};

// Static method to find upcoming appointments for a patient
appointmentSchema.statics.findUpcomingForPatient = function(patientId) {
  return this.find({
    patient: patientId,
    appointmentDate: { $gt: new Date() },
    status: { $in: ['Confirmed', 'Pending'] }
  }).populate('doctor', 'firstName lastName specialty profileImage')
    .sort({ appointmentDate: 1 });
};

// Static method to find today's appointments
appointmentSchema.statics.findTodayAppointments = function(doctorId) {
  const today = new Date();
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  return this.find({
    doctor: doctorId,
    appointmentDate: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  }).populate('patient', 'firstName lastName email profileImage')
    .sort({ appointmentDate: 1 });
};

// Static method to find guest bookings
appointmentSchema.statics.findGuestBookings = function() {
  return this.find({
    isGuestBooking: true
  }).sort({ appointmentDate: 1 });
};

module.exports = mongoose.model("Appointment", appointmentSchema);