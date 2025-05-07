const mongoose = require("mongoose");

// Check if the model is already compiled
const Prescription = mongoose.models.Prescription || mongoose.model("Prescription", new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",  // Updated to reference User model instead of Patient
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",  // Updated to reference User model instead of Doctor
    required: true,
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    // Not required, as prescriptions might be created outside of appointments
  },
  diagnosis: {
    type: String,
    required: true,
  },
  medications: [
    {
      name: { type: String, required: true },
      dosage: { type: String, required: true },
      frequency: { type: String, required: true },
      duration: { type: String },
      instructions: { type: String },
    },
  ],
  instructions: {
    type: String,
  },
  notes: {
    type: String,
  },
  pdfPath: {
    type: String, // Path to the generated PDF
    // Not required, as PDF might be generated after creation
  },
  isSent: {
    type: Boolean,
    default: false,
  },
  sentAt: {
    type: Date,
  },
  expiryDate: {
    type: Date,
  },
  isRefillable: {
    type: Boolean,
    default: false,
  },
  refillCount: {
    type: Number,
    default: 0,
  },
  maxRefills: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Expired', 'Revoked'],
    default: 'Active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true }));

module.exports = Prescription;