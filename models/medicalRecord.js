const mongoose = require('mongoose');

const medicalRecordSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recordType: {
    type: String,
    enum: ['General Checkup', 'Specialist Consultation', 'Lab Report', 'Imaging', 'Procedure', 'Follow-up', 'Emergency'],
    required: true
  },
  diagnosis: {
    type: String,
    required: true
  },
  treatment: {
    type: String
  },
  healthStatus: {
    type: String,
    enum: ['Critical', 'Needs Attention', 'Stable', 'Recovering', 'Excellent'],
    default: 'Stable'
  },
  notes: {
    type: String
  },
  summary: {
    type: String
  },
  attachments: [{
    fileName: String,
    filePath: String,
    fileType: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  visitDate: {
    type: Date,
    default: Date.now
  },
  followUpDate: {
    type: Date
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment'
  },
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Indexes for better performance
medicalRecordSchema.index({ patient: 1, createdAt: -1 });
medicalRecordSchema.index({ doctor: 1, createdAt: -1 });
medicalRecordSchema.index({ recordType: 1 });
medicalRecordSchema.index({ healthStatus: 1 });

// Virtual for formatting date
medicalRecordSchema.virtual('formattedDate').get(function() {
  return this.visitDate.toLocaleDateString();
});

// Virtual for days since visit
medicalRecordSchema.virtual('daysSinceVisit').get(function() {
  const now = new Date();
  const diff = now - this.visitDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Method to check if follow-up is needed
medicalRecordSchema.methods.isFollowUpNeeded = function() {
  if (!this.followUpDate) return false;
  return new Date() >= this.followUpDate;
};

// Method to add attachment
medicalRecordSchema.methods.addAttachment = function(fileName, filePath, fileType) {
  this.attachments.push({
    fileName,
    filePath,
    fileType,
    uploadDate: new Date()
  });
  this.updatedAt = new Date();
  return this.save();
};

// Method to share record with another user
medicalRecordSchema.methods.shareWith = function(userId) {
  // Check if already shared
  const alreadyShared = this.sharedWith.some(share => 
    share.user.toString() === userId.toString()
  );
  
  if (!alreadyShared) {
    this.sharedWith.push({
      user: userId,
      sharedAt: new Date()
    });
    this.isShared = true;
    this.updatedAt = new Date();
  }
  
  return this.save();
};

// Static method to find records by patient
medicalRecordSchema.statics.findByPatient = function(patientId) {
  return this.find({ patient: patientId })
    .populate('doctor', 'firstName lastName specialty profileImage')
    .sort({ createdAt: -1 });
};

// Static method to find records by doctor
medicalRecordSchema.statics.findByDoctor = function(doctorId) {
  return this.find({ doctor: doctorId })
    .populate('patient', 'firstName lastName email profileImage')
    .sort({ createdAt: -1 });
};

// Static method to find records by health status
medicalRecordSchema.statics.findByHealthStatus = function(status) {
  return this.find({ healthStatus: status })
    .populate('patient', 'firstName lastName email profileImage')
    .populate('doctor', 'firstName lastName specialty')
    .sort({ createdAt: -1 });
};

// Pre-save middleware to update timestamps
medicalRecordSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('MedicalRecord', medicalRecordSchema);