const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dob: { type: Date, required: true },
  gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/.+@.+\..+/, 'Invalid email format'],
  },
  phoneNumber: {
    type: String,
    required: true,
    match: [/^\d{10}$/, 'Phone number must be 10 digits'],
  },
  emergencyContact: {
    type: String,
    required: true,
    match: [/^\d{10}$/, 'Emergency contact must be 10 digits'],
  },
  languagesSpoken: { type: [String], required: true },
  password: { type: String, required: true, minlength: 8 },
  bloodGroup: {
    type: String,
    required: true,
    match: [/^(A|B|AB|O)[+-]$/, 'Invalid blood group format'],
  },
  medicalHistory: { type: String, required: true },
  medicalFiles: [{ type: String, required: true }], // Array of file paths
  govId: { type: String, required: true }, // Government-issued ID
  role: { type: String, default: 'patient', enum: ['patient'] },
});

// Hash password before saving
patientSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await require('bcryptjs').hash(this.password, 10);
  next();
});

// Compare password method
patientSchema.methods.comparePassword = async function (candidatePassword) {
  return await require('bcryptjs').compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Patient', patientSchema);
