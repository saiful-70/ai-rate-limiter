const express = require('express');
const authenticateToken = require('../middleware/auth');
const { rateLimiter } = require('../lib/rateLimiterInstance');

const router = express.Router();

// Shared rate limiter instance

/**
 * GET /api/status - Check remaining requests for current user
 */
router.get('/status', authenticateToken, (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const status = rateLimiter.getStatus(req.user, ip);

    res.json({
      success: true,
      remaining_requests: status.remaining,
      total_requests: status.total,
      user_type: status.userType,
      reset_time: new Date(status.resetTime).toISOString(),
      window_info: {
        size: '1 hour',
        reset_in_ms: status.resetTime - Date.now()
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status'
    });
  }
});

/**
 * GET /api/limits - Get rate limits for all user types
 */
router.get('/limits', (req, res) => {
  const limits = {
    guest: parseInt(process.env.GUEST_LIMIT) || 3,
    free: parseInt(process.env.FREE_LIMIT) || 10,
    premium: parseInt(process.env.PREMIUM_LIMIT) || 50
  };

  res.json({
    success: true,
    rate_limits: limits,
    window_size: `${parseInt(process.env.WINDOW_SIZE_HOURS) || 1} hour(s)`,
    algorithm: 'Fixed Window',
    tracking: {
      guests: 'By IP address',
      authenticated_users: 'By user ID'
    }
  });
});

/**
 * GET /api/health - Health check endpoint with detailed info
 */
router.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: Math.floor(uptime),
      formatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
    },
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
    },
    environment: process.env.NODE_ENV || 'development',
    version: require('../package.json').version
  });
});

/**
 * GET /api/debug/rate-limits - Debug endpoint to view current rate limit data
 * (Remove in production)
 */
router.get('/debug/rate-limits', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({
      success: false,
      error: 'Debug endpoint not available in production'
    });
  }

  const debugInfo = rateLimiter.getDebugInfo();
  
  res.json({
    success: true,
    message: 'Current rate limit data (debug mode)',
    data: debugInfo,
    note: 'This endpoint is only available in development mode'
  });
});

module.exports = router;
