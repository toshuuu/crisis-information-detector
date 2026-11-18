const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');
const authRoutes = require('./routes/authRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', apiRoutes);

// Health check endpoint for connectivity verification & offline sync
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    service: 'Crisis Ground Truth Validator API'
  });
});

// Basic root health check
app.get('/', (req, res) => res.send('Crisis Ground Truth Validator API is running'));

module.exports = app;
