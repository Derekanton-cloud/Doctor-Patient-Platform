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
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  phone: { type: String, required: true, match: /^\d{10}$/ },
  emergencyContact: { type: String, required: true, match: /^\d{10}$/ },
  languages: { type: [String], required: true },
  password: { type: String, required: true, select: false, minlength: [8, 'Password must be at least 8 characters long'] },


  // Patient-specific fields
  bloodGroup: { type: String, match: /^(A|B|AB|O)[+-]$/, required: false },
  medicalHistory: { type: String },
  medicalFiles: { type: [String] }, // Array of file paths
  governmentIssuedIdPatient: { type: [String] }, // For patient ID
  patientId: { type: String },

  // Doctor-specific fields
  licenseNumber: { type: String },
  licenseCertificates: { type: [String] },
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
}, {
  timestamps: true
});

userSchema.index({ role: 1 });

// Existing password hashing middleware
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Enhanced password comparison method with error handling
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

userSchema.pre('validate', function(next) {
  if (this.role === 'doctor') {
    if (!this.licenseNumber || !this.specialization || !this.currentWorkingHospital) {
      next(new Error('Doctors must provide license number, specialization, and current hospital'));
      return;
    }
  }
  
  if (this.role === 'patient') {
    if (!this.bloodGroup || !this.medicalHistory) {
      next(new Error('Patients must provide blood group and medical history'));
      return;
    }
  }
  
  next();
});


module.exports = mongoose.model("User", userSchema);
