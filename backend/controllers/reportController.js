const Report = require('../models/Report');
const User = require('../models/User');
const Notification = require('../models/Notification');
const socketHandler = require('../socket/socketHandler');

exports.createReport = async (req, res) => {
  try {
    const { userId, type, description, longitude, latitude, imageUrl } = req.body;
    
    const report = await Report.create({
      reporter: userId,
      type,
      description,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      },
      imageUrl
    });

    // Notify all connected clients about the new report on the map
    socketHandler.emitEvent('new_report', report);

    // 1. Create a confirmation notification for the reporter
    if (userId) {
      try {
        const reporterNotif = await Notification.create({
          user: userId,
          title: `Report Submitted: ${type.toUpperCase()}`,
          message: `Your crisis report has been broadcast to nearby validators.`,
          category: 'new_report',
          report: report._id,
          isRead: false
        });
        socketHandler.emitToUser(userId.toString(), 'notification', reporterNotif);
      } catch (err) {
        console.error('Failed to create reporter notification:', err.message);
      }
    }

    // 2. Create persistent notifications for other users
    try {
      const otherUsers = await User.find(
        userId ? { _id: { $ne: userId } } : {}
      ).select('_id').limit(100);

      if (otherUsers.length > 0) {
        const notifDocs = otherUsers.map(u => ({
          user: u._id,
          title: `Active Alert: ${type.toUpperCase()}`,
          message: description.length > 90 ? description.slice(0, 90) + '...' : description,
          category: 'new_report',
          report: report._id,
          isRead: false
        }));

        const createdNotifs = await Notification.insertMany(notifDocs);
        createdNotifs.forEach(n => {
          socketHandler.emitToUser(n.user.toString(), 'notification', n);
        });
      }
    } catch (err) {
      console.error('Failed to broadcast notifications to users:', err.message);
    }

    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 }).populate('reporter', 'name trustScore');
    res.status(200).json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id).populate('reporter', 'name trustScore');
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    
    // Notify clients that report was deleted
    socketHandler.emitEvent('delete_report', req.params.id);
    
    res.status(200).json({ message: 'Report deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
