const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["doctor", "patient"],
    required: true,
  },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, match: /^\d{10}$/ },
  emergencyContact: { type: String, required: true, match: /^\d{10}$/ },
  languages: { type: [String], required: true },
  password: { type: String, required: true },

  // Patient-specific fields
  bloodGroup: { type: String, match: /^(A|B|AB|O)[+-]$/, required: false },
  medicalHistory: { type: String },
  medicalFiles: { type: [String] }, // Array of file paths
  governmentIssuedIdPatient: { type: [String] }, // For patient ID
  patientId: { type: String },

  // Doctor-specific fields
  licenseNumber: { type: String },
  licenseCertificates: { type:[String] },
  boardIssuedDocuments: { type: [String] },
  specialization: { type: String },
  currentWorkingHospital: { type: String },
  governmentIssuedIds: { type: [String] },
  doctorId: { type: String },

  // Verification and Approval
  isVerified: { type: Boolean, default: false }, // OTP verification status
  isApproved: {
    type: Boolean,
    default: function () {
      return this.role === "patient"; // Auto-approve patients
    },
  },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
