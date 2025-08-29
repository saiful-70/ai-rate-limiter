const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const statusRoutes = require('./routes/status');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Routes
app.use('/api/auth', authRoutes);
// Also expose /api/login as an alias to /api/auth/login for convenience
app.post('/api/login', (req, res, next) => {
  // Delegate to authRoutes by rewriting URL to match the mounted router
  req.url = '/login';
  authRoutes(req, res, next);
});
app.use('/api', chatRoutes);
app.use('/api', statusRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AI Chat Rate Limiter API is running!',
    version: '1.0.0',
    endpoints: [
      'POST /api/chat - Send message to AI (rate limited)',
      'POST /api/login - Get user token',
      'GET /api/status - Check remaining requests'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `${req.method} ${req.originalUrl} not found`
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 AI Chat Rate Limiter server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 API URL: http://localhost:${PORT}`);
  });
}

module.exports = app;
