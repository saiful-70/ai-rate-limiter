# AI Chat Rate Limiter with Vercel AI SDK (Groq Provider)

A sophisticated rate limiting system for AI chatbots that controls usage costs by limiting requests based on user types. Built with Express.js and integrated with Vercel AI SDK using Groq's powerful LLaMA models.

## 🚀 Features

- **Beautiful Web Interface**: Interactive dashboard for testing and monitoring
- **Fixed Window Rate Limiting**: 1-hour windows for different user types
- **Multi-tier Rate Limits**:
  - 🔓 Guest users: 3 requests/hour (tracked by IP)
  - 👤 Free users: 10 requests/hour (tracked by user ID)
  - ⭐ Premium users: 50 requests/hour (tracked by user ID)
- **Cost-Effective**: Rate limits are checked BEFORE calling AI APIs
- **Groq AI Integration**: Real AI responses via Groq's LLaMA models
- **JWT Authentication**: Secure user authentication system
- **Comprehensive Testing**: Full test suite with Jest
- **Clean API**: RESTful endpoints with clear error messages
- **Mobile Responsive**: Works perfectly on all devices

## 📋 API Endpoints

### Web Interface
- `GET /` - Interactive web dashboard with authentication and chat

### Core API Endpoints
- `POST /api/chat` - Send message to AI (rate limited)
- `POST /api/auth/login` - Authenticate and get JWT token
- `GET /api/status` - Check remaining requests for current user

### Additional Endpoints
- `POST /api/auth/register` - Register new user (demo)
- `GET /api/auth/users` - Get demo users info
- `GET /api/limits` - Get rate limits configuration
- `GET /api/health` - Health check with system info
- `GET /api/chat/models` - Available Groq AI models

## 🛠️ Installation & Usage

### Method 1: Web Interface (Recommended)

1. **Clone and setup**:
```bash
cd "/home/saiful/Desktop/poridhi/Exam/Rate Limiter"
npm install
```

2. **Environment Setup**:
```bash
cp .env.example .env
# Edit .env file with your GROQ_API_KEY from https://console.groq.com/keys
```

3. **Start the server**:
```bash
npm start
# Open http://localhost:3000 in your browser
```

4. **Use the Web Interface**:
   - Click on demo users to quickly login
   - Or login as guest for IP-based rate limiting
   - Chat with AI and see rate limits in real-time
   - Monitor your usage with live status updates

### Method 2: API Only

## 🔧 Configuration

### Environment Variables

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
GROQ_API_KEY=your-groq-api-key-here

# Rate Limiting Configuration
GUEST_LIMIT=3
FREE_LIMIT=10
PREMIUM_LIMIT=50
WINDOW_SIZE_HOURS=1
```

### Demo Users

The system includes demo users for testing:

| Username | Password | Type | Limit |
|----------|----------|------|-------|
| `freeuser` | `password123` | free | 10 req/hour |
| `premiumuser` | `password123` | premium | 50 req/hour |

## 📊 Usage Examples

### 1. Guest User (No Authentication)
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello AI!"}'
```

### 2. Free User (With Authentication)
```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "freeuser", "password": "password123"}' \
  | jq -r '.token')

# Make AI request
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Hello AI!"}'
```

### 3. Check Rate Limit Status
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/status
```

## 🧪 Testing

### Run Test Suite
```bash
npm test
```

### Run Interactive Tests
```bash
./examples/test-rate-limiter.sh
```

### Test Coverage
```bash
npm test -- --coverage
```

## 📱 Example Responses

### Success Response
```json
{
  "success": true,
  "message": "AI response here...",
  "remaining_requests": 7,
  "user_type": "free",
  "model_used": "llama-3.1-8b-instant"
}
```

### Rate Limit Exceeded
```json
{
  "success": false,
  "error": "Too many requests. Free users can make 10 requests per hour.",
  "remaining_requests": 0,
  "reset_time": "2024-01-15T15:00:00.000Z",
  "user_type": "free"
}
```

### Status Check
```json
{
  "success": true,
  "remaining_requests": 8,
  "total_requests": 10,
  "user_type": "free",
  "reset_time": "2024-01-15T15:00:00.000Z",
  "window_info": {
    "size": "1 hour",
    "reset_in_ms": 3425000
  }
}
```

## 🏗️ Architecture

### Rate Limiting Algorithm
- **Fixed Window**: Resets every hour at fixed intervals
- **In-Memory Storage**: Fast lookups with automatic cleanup
- **User Tracking**: By user ID for authenticated, by IP for guests
- **Cost Protection**: Limits checked before AI API calls

### Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Error handling with appropriate HTTP status codes

### Scalability Considerations
- In-memory storage (suitable for single instance)
- For production: Consider Redis for distributed rate limiting
- Automatic cleanup of expired entries
- Configurable limits via environment variables

## 🚀 Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure real `GROQ_API_KEY`
4. Set appropriate rate limits
5. Use HTTPS in production

### Recommended Production Changes
- Replace in-memory storage with Redis
- Add request logging and monitoring
- Implement user management database
- Add rate limiting by endpoint
- Set up proper error tracking

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Check JWT token format and expiry
   - Verify JWT_SECRET matches

2. **Rate limits not working**
   - Check system time synchronization
   - Verify environment variables

3. **AI responses not working**
  - Ensure GROQ_API_KEY is set correctly
  - Check Groq API quota and billing
  - Verify API key from https://console.groq.com/keys

### Debug Endpoints
```bash
# Get current rate limit data (development only)
curl http://localhost:3000/api/debug/rate-limits

# Health check
curl http://localhost:3000/api/health
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

**Built with ❤️ using Express.js, Vercel AI SDK, and JWT Authentication**
