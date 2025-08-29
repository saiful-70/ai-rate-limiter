const request = require('supertest');
const app = require('../server');

describe('Rate Limiter API Tests', () => {
  let freeUserToken;
  let premiumUserToken;

  beforeAll(async () => {
    // Login as free user
    const freeUserLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'freeuser',
        password: 'password123'
      });
    
    freeUserToken = freeUserLogin.body.token;

    // Login as premium user
    const premiumUserLogin = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'premiumuser',
        password: 'password123'
      });
    
    premiumUserToken = premiumUserLogin.body.token;
  });

  describe('Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'freeuser',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.type).toBe('free');
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'freeuser',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('should get demo users info', async () => {
      const response = await request(app)
        .get('/api/auth/users');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.users).toHaveLength(2);
    });
  });

  describe('Rate Limiting - Guest Users', () => {
    test('should allow guest users up to 3 requests', async () => {
      const promises = Array(3).fill().map(() =>
        request(app)
          .post('/api/chat')
          .send({ message: 'Hello from guest' })
      );

      const responses = await Promise.all(promises);
      
      // First 3 requests should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user_type).toBe('guest');
      });
    });

    test('should block 4th request for guest users', async () => {
      // Make 3 requests first
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/chat')
          .send({ message: `Guest request ${i + 1}` });
      }

      // 4th request should be blocked
      const response = await request(app)
        .post('/api/chat')
        .send({ message: 'This should be blocked' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Too many requests');
      expect(response.body.remaining_requests).toBe(0);
    });
  });

  describe('Rate Limiting - Free Users', () => {
    test('should allow free users up to 10 requests', async () => {
      const promises = Array(5).fill().map((_, index) =>
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${freeUserToken}`)
          .send({ message: `Free user message ${index + 1}` })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user_type).toBe('free');
      });
    });

    test('should track remaining requests correctly for free users', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', `Bearer ${freeUserToken}`)
        .send({ message: 'Track remaining requests' });

      expect(response.status).toBe(200);
      expect(response.body.remaining_requests).toBeGreaterThanOrEqual(0);
      expect(response.body.remaining_requests).toBeLessThan(10);
    });
  });

  describe('Rate Limiting - Premium Users', () => {
    test('should allow premium users more requests', async () => {
      const promises = Array(5).fill().map((_, index) =>
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${premiumUserToken}`)
          .send({ message: `Premium user message ${index + 1}` })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.user_type).toBe('premium');
      });
    });
  });

  describe('Status Endpoints', () => {
    test('should get rate limit status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/status')
        .set('Authorization', `Bearer ${freeUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user_type).toBe('free');
      expect(response.body.total_requests).toBe(10);
      expect(response.body.remaining_requests).toBeGreaterThanOrEqual(0);
    });

    test('should get rate limits configuration', async () => {
      const response = await request(app)
        .get('/api/limits');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.rate_limits).toHaveProperty('guest', 3);
      expect(response.body.rate_limits).toHaveProperty('free', 10);
      expect(response.body.rate_limits).toHaveProperty('premium', 50);
    });

    test('should get health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body.uptime).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    test('should reject empty messages', async () => {
      const response = await request(app)
        .post('/api/chat')
        .send({ message: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Message is required');
    });

    test('should reject messages over 1000 characters', async () => {
      const longMessage = 'a'.repeat(1001);
      
      const response = await request(app)
        .post('/api/chat')
        .send({ message: longMessage });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('less than 1000 characters');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid JWT token', async () => {
      const response = await request(app)
        .post('/api/chat')
        .set('Authorization', 'Bearer invalid-token')
        .send({ message: 'Test message' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    test('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
