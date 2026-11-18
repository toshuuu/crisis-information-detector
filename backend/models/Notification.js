const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ['new_report', 'verification', 'status_change', 'reward', 'system'],
    default: 'system',
  },
  // Optional reference to related report
  report: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  isDismissed: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Compound index for efficient per-user queries (newest first, non-dismissed)
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
