const { RateLimiter } = require('../middleware/rateLimiter');

// Singleton RateLimiter instance shared across routes
const rateLimiter = new RateLimiter();

module.exports = { rateLimiter };
