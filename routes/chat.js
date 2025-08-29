const express = require('express');
const authenticateToken = require('../middleware/auth');
const { createRateLimitMiddleware } = require('../middleware/rateLimiter');
const { rateLimiter } = require('../lib/rateLimiterInstance');

const router = express.Router();

// Initialize rate limiter middleware (shared instance)
const rateLimitMiddleware = createRateLimitMiddleware(rateLimiter);

// Validate input early (before rate limiting) to avoid consuming quota
const validateMessage = (req, res, next) => {
  const { message } = req.body || {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a non-empty string'
    });
  }
  if (message.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Message must be less than 1000 characters'
    });
  }
  next();
};

/**
 * POST /api/chat - Send message to AI (rate limited)
 */
router.post('/chat', authenticateToken, validateMessage, rateLimitMiddleware, async (req, res) => {
  try {
  const { message, model = 'llama-3.1-8b-instant' } = req.body;

    // Check if OpenAI API key is configured
  // Only mock in tests, or when no GROQ key and mock explicitly enabled
  if (process.env.NODE_ENV === 'test' || (!process.env.GROQ_API_KEY && process.env.USE_MOCK_AI === 'true')) {
      // Mock AI response for demo purposes
      const mockResponses = [
        "Hello! I'm a mock AI assistant. In production, this would be powered by Groq via the AI SDK.",
        "This is a simulated response since no Groq API key is configured. The rate limiting is working perfectly though!",
        "I'm here to help! This is a demo response. Configure your GROQ_API_KEY in the .env file for real AI responses.",
        "Mock AI response: Your rate limiting system is working great! This would be a real AI response with proper API key configuration.",
        "Demo mode activated! Your message was received and the rate limiter is functioning correctly."
      ];

      const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)];
      
      // Add small delay to simulate AI processing time
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      return res.json({
        success: true,
        message: randomResponse,
        remaining_requests: req.rateLimit.remaining,
        user_type: req.rateLimit.userType,
        model_used: 'mock-groq-llama3',
        is_demo: true
      });
    }

    // Real AI response using Vercel AI SDK with Groq provider
    const { generateText } = await import('ai');
    const { createGroq } = await import('@ai-sdk/groq');
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

    const result = await generateText({
      model: groq(model),
      prompt: message,
      maxTokens: 150,
      temperature: 0.7,
    });

    const aiResponse = result.text || 'No response generated';

    res.json({
      success: true,
      message: aiResponse,
      remaining_requests: req.rateLimit.remaining,
      user_type: req.rateLimit.userType,
      model_used: model
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    // Map common auth/quota errors
    if (String(error?.message || '').toLowerCase().includes('api key')) {
      return res.status(401).json({ success: false, error: 'Invalid GROQ_API_KEY configured.', remaining_requests: req.rateLimit?.remaining });
    }
    if (String(error?.message || '').toLowerCase().includes('quota')) {
      return res.status(402).json({ success: false, error: 'Groq API quota exceeded. Please check your plan.', remaining_requests: req.rateLimit?.remaining });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate AI response',
      remaining_requests: req.rateLimit?.remaining,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/chat/models - Get available AI models
 */
router.get('/chat/models', authenticateToken, (req, res) => {
  res.json({
    success: true,
    models: [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', description: 'Fast, cost-effective' },
      { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B Versatile', description: 'Higher quality responses' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k)', description: 'Large context, strong reasoning' }
    ],
    default: 'llama-3.1-8b-instant'
  });
});

module.exports = router;
