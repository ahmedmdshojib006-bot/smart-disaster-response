const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',      
    default: null,
  },

  targetRole: {
    type: String,
    enum: ['Admin', 'Volunteer', 'NGO', 'Citizen', 'Donor', null],
    default: null,
  },

  type: {
    type: String,
    enum: ['sos', 'weather', 'evacuation', 'general'],
    required: [true, 'Notification type is required'],
  },

  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },

  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
  },

  isRead: {
    type: Boolean,
    default: false,
  },

  relatedId: {
    type: String,
    default: null,
  },

  relatedType: {
    type: String,
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.index({ recipient: 1 });
notificationSchema.index({ targetRole: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
