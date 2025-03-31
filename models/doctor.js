const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
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
  specialization: { type: String, required: true },
  currentHospital: { type: String, required: true },
  licenseNumber: {
    type: String,
    required: true,
    match: [/^[A-Z0-9-]+$/, 'Invalid license number format'],
  },
  licenseCertificate: { type: String, required: true }, // Path to uploaded file
  boardCertificate: { type: String, required: true }, // Path to uploaded file
  govId: { type: String, required: true }, // Path to government ID
  isApproved: { type: Boolean, default: false },
  role: { type: String, default: 'doctor', enum: ['doctor'] },
});

// Hash password before saving
doctorSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await require('bcryptjs').hash(this.password, 10);
  next();
});

// Compare password method
doctorSchema.methods.comparePassword = async function (candidatePassword) {
  return await require('bcryptjs').compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Doctor', doctorSchema);
