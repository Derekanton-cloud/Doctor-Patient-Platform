const mongoose = require('mongoose');

const timeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startTime: {
    type: String, 
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  slotDuration: {
    type: Number, // Duration in minutes
    default: 30
  }
});

const doctorAvailabilitySchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  availableSlots: [timeSlotSchema],
  isOnLeave: {
    type: Boolean,
    default: false
  },
  leaveStartDate: {
    type: Date
  },
  leaveEndDate: {
    type: Date
  },
  leaveReason: {
    type: String
  }
}, {
  timestamps: true
});

// Create a compound index to ensure we have unique availability entries per doctor
doctorAvailabilitySchema.index({ doctor: 1 }, { unique: true });

const DoctorAvailability = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);

module.exports = DoctorAvailability;