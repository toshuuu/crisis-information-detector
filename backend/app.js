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

// Basic health check
app.get('/', (req, res) => res.send('Crisis Ground Truth Validator API is running'));

module.exports = app;
