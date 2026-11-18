const Report = require('../models/Report');
const User = require('../models/User');
const Notification = require('../models/Notification');
const socketHandler = require('../socket/socketHandler');

exports.createReport = async (req, res) => {
  try {
    const { userId, type, description, longitude, latitude, imageUrl, clientReportId, isOfflineSubmission, clientCreatedAt } = req.body;

    // Validate inputs
    if (!type || !description || longitude === undefined || latitude === undefined) {
      return res.status(400).json({ error: 'Missing required report fields (type, description, coordinates)' });
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: 'Invalid latitude or longitude coordinates' });
    }

    // Idempotency check: prevent duplicate submissions if offline sync retries
    if (clientReportId) {
      const existing = await Report.findOne({ clientReportId }).populate('reporter', 'name trustScore');
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    
    const report = await Report.create({
      reporter: userId,
      type,
      description,
      location: {
        type: 'Point',
        coordinates: [lngNum, latNum]
      },
      imageUrl,
      clientReportId,
      isOfflineSubmission: Boolean(isOfflineSubmission),
      clientCreatedAt: clientCreatedAt ? new Date(clientCreatedAt) : new Date()
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
