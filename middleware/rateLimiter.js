/**
 * Fixed Window Rate Limiter
 * Tracks requests in 1-hour windows based on user type
 */
class RateLimiter {
  constructor() {
    // In-memory storage for rate limiting
    // Format: { key: { count: number, windowStart: timestamp } }
    this.storage = new Map();
    
    // Rate limits per user type (requests per hour)
    this.limits = {
      guest: parseInt(process.env.GUEST_LIMIT) || 3,
      free: parseInt(process.env.FREE_LIMIT) || 10,
      premium: parseInt(process.env.PREMIUM_LIMIT) || 50
    };
    
    // Window size in milliseconds (1 hour)
    this.windowSize = (parseInt(process.env.WINDOW_SIZE_HOURS) || 1) * 60 * 60 * 1000;
    
    // Clean up expired entries every 10 minutes
    this._cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    // Don't keep Node process alive because of this timer (useful for tests)
    if (typeof this._cleanupInterval.unref === 'function') {
      this._cleanupInterval.unref();
    }
  }

  /**
   * Get unique key for rate limiting
   * @param {Object} user - User object
   * @param {string} ip - IP address
   * @returns {string} Unique key
   */
  getKey(user, ip) {
    if (user && user.type !== 'guest' && user.id) {
      return `user:${user.id}`;
    }
    return `ip:${ip}`;
  }

  /**
   * Get rate limit for user type
   * @param {Object} user - User object
   * @returns {number} Rate limit
   */
  getLimit(user) {
    const userType = user?.type || 'guest';
    return this.limits[userType] || this.limits.guest;
  }

  /**
   * Check if request is allowed
   * @param {Object} user - User object
   * @param {string} ip - IP address
   * @returns {Object} Result with allowed status and remaining requests
   */
  checkLimit(user, ip) {
    const key = this.getKey(user, ip);
    const limit = this.getLimit(user);
    const now = Date.now();
    
    // Get or initialize window data
    let windowData = this.storage.get(key);
    
    if (!windowData || (now - windowData.windowStart) >= this.windowSize) {
      // New window or expired window
      windowData = {
        count: 0,
        windowStart: now
      };
      this.storage.set(key, windowData);
    }
    
    const remaining = Math.max(0, limit - windowData.count);
    const allowed = windowData.count < limit;
    
    if (allowed) {
      windowData.count++;
      this.storage.set(key, windowData);
    }
    
    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      total: limit,
      resetTime: windowData.windowStart + this.windowSize,
      userType: user?.type || 'guest'
    };
  }

  /**
   * Get current status without incrementing count
   * @param {Object} user - User object
   * @param {string} ip - IP address
   * @returns {Object} Current status
   */
  getStatus(user, ip) {
    const key = this.getKey(user, ip);
    const limit = this.getLimit(user);
    const now = Date.now();
    
    let windowData = this.storage.get(key);
    
    if (!windowData || (now - windowData.windowStart) >= this.windowSize) {
      return {
        remaining: limit,
        total: limit,
        resetTime: now + this.windowSize,
        userType: user?.type || 'guest'
      };
    }
    
    return {
      remaining: Math.max(0, limit - windowData.count),
      total: limit,
      resetTime: windowData.windowStart + this.windowSize,
      userType: user?.type || 'guest'
    };
  }

  /**
   * Clean up expired entries from storage
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, data] of this.storage.entries()) {
      if ((now - data.windowStart) >= this.windowSize) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.storage.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} expired rate limit entries`);
    }
  }

  /**
   * Reset rate limit for a specific user/IP
   * @param {Object} user - User object
   * @param {string} ip - IP address
   */
  reset(user, ip) {
    const key = this.getKey(user, ip);
    this.storage.delete(key);
  }

  /**
   * Get all current rate limit data (for debugging)
   */
  getDebugInfo() {
    const data = {};
    for (const [key, value] of this.storage.entries()) {
      data[key] = {
        ...value,
        timeRemaining: Math.max(0, (value.windowStart + this.windowSize) - Date.now())
      };
    }
    return data;
  }
}

// Middleware factory
const createRateLimitMiddleware = (rateLimiter) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
    const result = rateLimiter.checkLimit(req.user, ip);
    
    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': result.total,
      'X-RateLimit-Remaining': result.remaining,
      'X-RateLimit-Reset': new Date(result.resetTime).toISOString()
    });
    
    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many requests. ${result.userType.charAt(0).toUpperCase() + result.userType.slice(1)} users can make ${result.total} requests per hour.`,
        remaining_requests: result.remaining,
        reset_time: new Date(result.resetTime).toISOString(),
        user_type: result.userType
      });
    }
    
    // Add rate limit info to request for use in routes
    req.rateLimit = result;
    next();
  };
};

module.exports = { RateLimiter, createRateLimitMiddleware };
