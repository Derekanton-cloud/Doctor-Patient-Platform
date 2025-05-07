const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  attachments: [{
    fileName: String,
    filePath: String,
    fileType: String,
    fileSize: Number
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

// Indexes for better query performance
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ createdAt: -1 });

// Virtual for checking if message is from a doctor
messageSchema.virtual('isFromDoctor').get(function() {
  return this.populated('sender') ? this.sender.role === 'doctor' : false;
});

// Virtual for checking if message is from a patient
messageSchema.virtual('isFromPatient').get(function() {
  return this.populated('sender') ? this.sender.role === 'patient' : false;
});

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.updatedAt = new Date();
  return this.save();
};

// Static method to get unread count for a user
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

// Static method to get conversation between two users
messageSchema.statics.getConversation = function(user1Id, user2Id) {
  return this.find({
    $or: [
      { sender: user1Id, recipient: user2Id },
      { sender: user2Id, recipient: user1Id }
    ]
  })
  .populate('sender', 'firstName lastName role profileImage')
  .populate('recipient', 'firstName lastName role profileImage')
  .sort({ createdAt: 1 });
};

// Static method to get all conversations for a user
messageSchema.statics.getConversations = async function(userId) {
  // First, find all users this user has communicated with
  const sent = await this.distinct('recipient', { sender: userId });
  const received = await this.distinct('sender', { recipient: userId });
  
  // Combine and remove duplicates
  const conversationPartners = [...new Set([...sent, ...received])];
  
  // For each partner, get the latest message
  const conversations = await Promise.all(conversationPartners.map(async (partnerId) => {
    const latestMessage = await this.findOne({
      $or: [
        { sender: userId, recipient: partnerId },
        { sender: partnerId, recipient: userId }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('sender', 'firstName lastName role profileImage')
    .populate('recipient', 'firstName lastName role profileImage');
    
    // Count unread messages from this partner
    const unreadCount = await this.countDocuments({
      sender: partnerId,
      recipient: userId,
      isRead: false
    });
    
    return {
      partner: latestMessage.sender._id.toString() === userId.toString() ? 
               latestMessage.recipient : latestMessage.sender,
      lastMessage: latestMessage,
      unreadCount
    };
  }));
  
  // Sort by most recent message
  return conversations.sort((a, b) => 
    b.lastMessage.createdAt - a.lastMessage.createdAt
  );
};

module.exports = mongoose.model('Message', messageSchema);