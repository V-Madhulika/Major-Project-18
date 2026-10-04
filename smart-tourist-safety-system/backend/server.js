const express = require('express');
const { auth } = require('./middleware/auth');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { createServer } = require('http');
require('dotenv').config();

// Import database connection and routes
const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const verificationRoutes = require('./routes/verification');
const SocketHandler = require('./socket/socketHandler');
const User = require('./models/User');
const Alert = require('./models/Alert');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.IO
const server = createServer(app);

// Initialize Socket.IO
const socketHandler = new SocketHandler(server);

// Connect to database
connectDB();

// Middleware - Configure helmet to allow Socket.IO CDN
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        process.env.WS_URL || "ws://localhost:5000",
        process.env.WSS_URL || "wss://localhost:5000",
        process.env.API_BASE_URL || "http://localhost:5000"
      ]
    }
  }
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (for monitoring dashboard)
app.use(express.static(require('path').join(__dirname, 'public')));

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Smart Tourist Safety System API',
    version: '1.0.0',
    status: 'running'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', verificationRoutes);

// Socket.IO stats endpoint
app.get('/api/socket/stats', (req, res) => {
  res.json(socketHandler.getStats());
});

// Alert statistics endpoint
app.get('/api/alerts/stats', (req, res) => {
  const stats = socketHandler.getAlertStats();
  res.json({
    success: true,
    stats: {
      totalAlerts: stats.totalAlerts || 0,
      activeAlerts: stats.activeAlerts || 0,
      resolvedAlerts: stats.resolvedAlerts || 0,
      lastAlert: stats.lastAlert || null
    }
  });
});

// Get all emergency alerts (for admin)
app.get('/api/alerts/emergency', (req, res) => {
  const alerts = socketHandler.getEmergencyAlerts();
  res.json({
    success: true,
    alerts: alerts || []
  });
});

// Resolve an alert (for admin)
app.post('/api/alerts/:alertId/resolve', (req, res) => {
  const { alertId } = req.params;
  const resolved = socketHandler.resolveAlert(alertId);
  
  if (resolved) {
    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });
  } else {
    res.status(404).json({
      success: false,
      message: 'Alert not found'
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    socketStats: socketHandler.getStats()
  });
});

// Safe API Routes
app.post('/api/location/update', auth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      lastLocation: {
        type: 'Point',
        coordinates: [longitude, latitude],
        timestamp: new Date()
      }
    });
    res.json({ success: true, message: 'Location updated' });
  } catch (err) {
    console.error('Error updating location:', err);
    res.status(500).json({ success: false, message: 'Failed to update location' });
  }
});

app.post('/api/emergency/alert', auth, async (req, res) => {
  try {
    const { type, location, message } = req.body;
    const alert = await Alert.create({
      tourist: req.user._id,
      type: type || 'panic',
      location: {
        type: 'Point',
        coordinates: [location?.longitude || 77.2090, location?.latitude || 28.6139]
      },
      message
    });
    
    // Store in socketHandler and broadcast to admins
    const emergencyData = socketHandler.createEmergencyAlert({
      alertId: alert._id.toString(),
      userId: req.user._id.toString(),
      digitalId: req.user.digitalId,
      emergencyType: type || 'panic',
      location: location || { latitude: 28.6139, longitude: 77.2090 },
      timestamp: alert.createdAt,
      message: message || 'Emergency alert triggered'
    });

    res.status(201).json({ success: true, alertId: alert._id, alert: emergencyData });
  } catch (err) {
    console.error('Error triggering alert:', err);
    res.status(500).json({ success: false, message: 'Failed to trigger alert' });
  }
});

// Demo/Simulation route for testing & presentations
app.post('/api/alerts/simulate', (req, res) => {
  try {
    const { emergencyType, message, location, touristName, digitalId, priority } = req.body || {};
    
    const simAlert = socketHandler.createEmergencyAlert({
      userId: 'simulated-tourist-' + Date.now().toString().slice(-4),
      digitalId: digitalId || 'TID' + Date.now().toString().slice(-10),
      emergencyType: emergencyType || 'panic',
      priority: priority || 'HIGH',
      location: location || { 
        latitude: 28.6129 + (Math.random() * 0.02 - 0.01), 
        longitude: 77.2295 + (Math.random() * 0.02 - 0.01) 
      },
      message: message || `🚨 SOS: Tourist ${touristName || 'Traveler'} triggered panic alert near New Delhi Central!`
    });

    res.json({
      success: true,
      message: 'Simulation alert created successfully',
      alert: simAlert
    });
  } catch (err) {
    console.error('Error simulating alert:', err);
    res.status(500).json({ success: false, message: 'Failed to simulate alert' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server with Socket.IO running on port ${PORT}`);
  console.log(`📱 Smart Tourist Safety System API`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time connections`);
});

module.exports = app;
