const { RateLimiter } = require('../middleware/rateLimiter');

describe('Rate Limiter Unit Tests', () => {
  let rateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    // Clear any timers
    rateLimiter.storage.clear();
  });

  describe('Key Generation', () => {
    test('should generate user-based key for authenticated users', () => {
      const user = { type: 'free', id: 123 };
      const ip = '192.168.1.1';
      const key = rateLimiter.getKey(user, ip);
      
      expect(key).toBe('user:123');
    });

    test('should generate IP-based key for guest users', () => {
      const user = { type: 'guest', id: null };
      const ip = '192.168.1.1';
      const key = rateLimiter.getKey(user, ip);
      
      expect(key).toBe('ip:192.168.1.1');
    });

    test('should generate IP-based key when no user provided', () => {
      const ip = '192.168.1.1';
      const key = rateLimiter.getKey(null, ip);
      
      expect(key).toBe('ip:192.168.1.1');
    });
  });

  describe('Rate Limits', () => {
    test('should return correct limits for different user types', () => {
      expect(rateLimiter.getLimit({ type: 'guest' })).toBe(3);
      expect(rateLimiter.getLimit({ type: 'free' })).toBe(10);
      expect(rateLimiter.getLimit({ type: 'premium' })).toBe(50);
      expect(rateLimiter.getLimit(null)).toBe(3); // Default to guest
    });
  });

  describe('Rate Limiting Logic', () => {
    test('should allow requests within limit', () => {
      const user = { type: 'free', id: 1 };
      const ip = '192.168.1.1';

      // First request should be allowed
      const result1 = rateLimiter.checkLimit(user, ip);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(9);
      expect(result1.total).toBe(10);

      // Second request should be allowed
      const result2 = rateLimiter.checkLimit(user, ip);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(8);
    });

    test('should block requests when limit exceeded', () => {
      const user = { type: 'guest', id: null };
      const ip = '192.168.1.1';

      // Make 3 requests (guest limit)
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit(user, ip);
        expect(result.allowed).toBe(true);
      }

      // 4th request should be blocked
      const result = rateLimiter.checkLimit(user, ip);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should track different users separately', () => {
      const user1 = { type: 'free', id: 1 };
      const user2 = { type: 'free', id: 2 };
      const ip = '192.168.1.1';

      // User 1 makes requests
      for (let i = 0; i < 5; i++) {
        const result = rateLimiter.checkLimit(user1, ip);
        expect(result.allowed).toBe(true);
      }

      // User 2 should have full limit available
      const result = rateLimiter.checkLimit(user2, ip);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('should track different IPs separately for guests', () => {
      const user = { type: 'guest', id: null };
      const ip1 = '192.168.1.1';
      const ip2 = '192.168.1.2';

      // IP1 uses full limit
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit(user, ip1);
        expect(result.allowed).toBe(true);
      }

      // IP2 should have full limit available
      const result = rateLimiter.checkLimit(user, ip2);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('Status Checking', () => {
    test('should return current status without incrementing count', () => {
      const user = { type: 'free', id: 1 };
      const ip = '192.168.1.1';

      // Make one request
      rateLimiter.checkLimit(user, ip);

      // Check status multiple times
      const status1 = rateLimiter.getStatus(user, ip);
      const status2 = rateLimiter.getStatus(user, ip);

      expect(status1.remaining).toBe(9);
      expect(status2.remaining).toBe(9); // Should not change
      expect(status1.total).toBe(10);
      expect(status1.userType).toBe('free');
    });

    test('should return full limit for new user', () => {
      const user = { type: 'premium', id: 1 };
      const ip = '192.168.1.1';

      const status = rateLimiter.getStatus(user, ip);
      
      expect(status.remaining).toBe(50);
      expect(status.total).toBe(50);
      expect(status.userType).toBe('premium');
    });
  });

  describe('Window Reset', () => {
    test('should reset window after expiry', (done) => {
      // Mock a very short window for testing (10ms)
      rateLimiter.windowSize = 10;
      
      const user = { type: 'guest', id: null };
      const ip = '192.168.1.1';

      // Use up all requests
      for (let i = 0; i < 3; i++) {
        const result = rateLimiter.checkLimit(user, ip);
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const blockedResult = rateLimiter.checkLimit(user, ip);
      expect(blockedResult.allowed).toBe(false);

      // Wait for window to expire
      setTimeout(() => {
        // Should be allowed again
        const newResult = rateLimiter.checkLimit(user, ip);
        expect(newResult.allowed).toBe(true);
        expect(newResult.remaining).toBe(2);
        done();
      }, 15);
    });
  });

  describe('Cleanup', () => {
    test('should clean up expired entries', (done) => {
      // Mock short window
      rateLimiter.windowSize = 10;
      
      const user = { type: 'free', id: 1 };
      const ip = '192.168.1.1';

      // Make a request to create an entry
      rateLimiter.checkLimit(user, ip);
      
      // Should have one entry
      expect(rateLimiter.storage.size).toBe(1);

      // Wait for expiry and cleanup
      setTimeout(() => {
        rateLimiter.cleanup();
        expect(rateLimiter.storage.size).toBe(0);
        done();
      }, 15);
    });
  });

  describe('Reset Functionality', () => {
    test('should reset rate limit for specific user', () => {
      const user = { type: 'free', id: 1 };
      const ip = '192.168.1.1';

      // Make some requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit(user, ip);
      }

      // Check remaining
      let status = rateLimiter.getStatus(user, ip);
      expect(status.remaining).toBe(5);

      // Reset
      rateLimiter.reset(user, ip);

      // Should have full limit again
      status = rateLimiter.getStatus(user, ip);
      expect(status.remaining).toBe(10);
    });
  });
});
