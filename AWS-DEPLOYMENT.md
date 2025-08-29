# AWS Deployment Guide for AI Chat Rate Limiter

This guide provides step-by-step instructions for deploying the AI Chat Rate Limiter to AWS using different methods.

## 🚀 Deployment Options

### Option 1: AWS Elastic Beanstalk (Recommended for beginners)
### Option 2: AWS EC2 with Docker
### Option 3: AWS Lambda with API Gateway (Serverless)

---

## 🌱 Option 1: AWS Elastic Beanstalk

Elastic Beanstalk is the easiest way to deploy Node.js applications to AWS.

### Prerequisites
- AWS CLI installed and configured
- EB CLI installed
- Your application code ready

### Step 1: Install AWS and EB CLI

```bash
# Install AWS CLI (if not already installed)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install EB CLI
pip install awsebcli

# Configure AWS credentials
aws configure
```

### Step 2: Prepare Application for Deployment

```bash
# Navigate to your project directory
cd "/home/saiful/Desktop/poridhi/Exam/Rate Limiter"

# Create .ebextensions directory for AWS configuration
mkdir .ebextensions

# Create configuration file for environment variables
cat > .ebextensions/environment.config << 'EOF'
option_settings:
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
    JWT_SECRET: your-production-jwt-secret-change-this
    GUEST_LIMIT: 3
    FREE_LIMIT: 10
    PREMIUM_LIMIT: 50
    WINDOW_SIZE_HOURS: 1
EOF
```

### Step 3: Initialize and Deploy

```bash
# Initialize Elastic Beanstalk application
eb init

# Select region (e.g., us-east-1)
# Choose Node.js platform
# Select the latest Node.js version

# Create environment and deploy
eb create ai-chat-rate-limiter-prod

# Deploy updates
eb deploy

# Open application in browser
eb open
```

### Step 4: Configure Environment Variables

```bash
# Set OpenAI API key (replace with your key)
eb setenv GROQ_API_KEY=your-groq-api-key-here

# Set production JWT secret
eb setenv JWT_SECRET=your-super-secure-production-jwt-secret

# Check environment variables
eb printenv
```

### Step 5: Monitor and Logs

```bash
# View logs
eb logs

# Check status
eb status

# SSH into instance (if needed)
eb ssh
```

---

## 🐳 Option 2: AWS EC2 with Docker

Deploy using Docker containers on EC2 for more control.

### Step 1: Create Dockerfile

```dockerfile
# Create Dockerfile in project root
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]
EOF
```

### Step 2: Create docker-compose.yml

```yaml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - JWT_SECRET=${JWT_SECRET:-your-default-secret}
  - GROQ_API_KEY=${GROQ_API_KEY}
      - GUEST_LIMIT=3
      - FREE_LIMIT=10
      - PREMIUM_LIMIT=50
      - WINDOW_SIZE_HOURS=1
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF
```

### Step 3: Launch EC2 Instance

```bash
# Create EC2 instance (using AWS CLI)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1d0 \
  --count 1 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=ai-chat-rate-limiter}]'
```

### Step 4: Deploy to EC2

```bash
# SSH to EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone or copy your code to EC2
# Then run:
export JWT_SECRET="your-production-jwt-secret"
export GROQ_API_KEY="your-groq-api-key"

docker-compose up -d
```

### Step 5: Setup Load Balancer and Auto Scaling (Optional)

```bash
# Create Application Load Balancer
aws elbv2 create-load-balancer \
  --name ai-chat-rate-limiter-alb \
  --subnets subnet-xxxxxxxx subnet-yyyyyyyy \
  --security-groups sg-xxxxxxxxx

# Create target group
aws elbv2 create-target-group \
  --name ai-chat-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxxxxx \
  --health-check-path /api/health
```

---

## ⚡ Option 3: AWS Lambda with API Gateway (Serverless)

Deploy as serverless functions for cost optimization.

### Step 1: Install Serverless Framework

```bash
npm install -g serverless
npm install serverless-http
```

### Step 2: Create serverless.yml

```yaml
cat > serverless.yml << 'EOF'
service: ai-chat-rate-limiter

provider:
  name: aws
  runtime: nodejs18.x
  stage: prod
  region: us-east-1
  environment:
    NODE_ENV: production
    JWT_SECRET: ${env:JWT_SECRET}
  GROQ_API_KEY: ${env:GROQ_API_KEY}
    GUEST_LIMIT: 3
    FREE_LIMIT: 10
    PREMIUM_LIMIT: 50
    WINDOW_SIZE_HOURS: 1

functions:
  api:
    handler: lambda.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true
      - http:
          path: /
          method: ANY
          cors: true

plugins:
  - serverless-offline

package:
  exclude:
    - tests/**
    - examples/**
    - .git/**
    - README.md
EOF
```

### Step 3: Create Lambda Handler

```javascript
cat > lambda.js << 'EOF'
const serverless = require('serverless-http');
const app = require('./server');

// Wrap Express app for Lambda
module.exports.handler = serverless(app, {
  // Strip base path from API Gateway
  basePath: '/prod'
});
EOF
```

### Step 4: Deploy to Lambda

```bash
# Set environment variables
export JWT_SECRET="your-production-jwt-secret"
export GROQ_API_KEY="your-groq-api-key"

# Deploy
serverless deploy

# Get endpoint URL
serverless info
```

---

## 🧪 Testing Deployed Application

### Test Script for AWS Deployment

```bash
# Create test script for deployed app
cat > test-deployed-app.sh << 'EOF'
#!/bin/bash

# Replace with your deployed URL
API_URL="https://your-app-url.com/api"

echo "🧪 Testing Deployed AI Chat Rate Limiter"
echo "========================================"

# Test health endpoint
echo "1. Health Check:"
curl -s "$API_URL/health" | jq '.'

echo -e "\n2. Get Rate Limits:"
curl -s "$API_URL/limits" | jq '.'

echo -e "\n3. Test Guest Request:"
curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from deployed app!"}' | jq '.'

echo -e "\n4. Login as Free User:"
TOKEN=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "freeuser", "password": "password123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

echo -e "\n5. Test Authenticated Request:"
curl -s -X POST "$API_URL/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"message": "Hello from authenticated user!"}' | jq '.'

echo -e "\n6. Check Status:"
curl -s "$API_URL/status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

EOF

chmod +x test-deployed-app.sh
```

---

## 🔒 Security Best Practices for AWS Deployment

### 1. Environment Variables Security

```bash
# Use AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/ai-chat-rate-limiter/jwt-secret" \
  --value "your-super-secure-jwt-secret" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/ai-chat-rate-limiter/openai-api-key" \
  --value "your-openai-api-key" \
  --type "SecureString"
```

### 2. Security Groups Configuration

```bash
# Create security group for EC2
aws ec2 create-security-group \
  --group-name ai-chat-rate-limiter-sg \
  --description "Security group for AI Chat Rate Limiter"

# Allow HTTP traffic
aws ec2 authorize-security-group-ingress \
  --group-name ai-chat-rate-limiter-sg \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0

# Allow SSH access
aws ec2 authorize-security-group-ingress \
  --group-name ai-chat-rate-limiter-sg \
  --protocol tcp \
  --port 22 \
  --cidr your-ip/32
```

### 3. SSL/TLS Certificate

```bash
# Request SSL certificate using AWS Certificate Manager
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS
```

---

## 📊 Monitoring and Logging

### CloudWatch Setup

```bash
# Create log group
aws logs create-log-group \
  --log-group-name /aws/ai-chat-rate-limiter

# Create CloudWatch alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name ai-chat-high-error-rate \
  --alarm-description "High error rate in AI Chat Rate Limiter" \
  --metric-name 4XXError \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold
```

### Application Performance Monitoring

Add to your application:

```javascript
// Add to server.js for basic monitoring
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});
```

---

## 💰 Cost Optimization

### 1. Choose Right Instance Size
- **Development**: t3.micro (free tier eligible)
- **Production**: t3.small or t3.medium
- **High Traffic**: m5.large with auto-scaling

### 2. Use Spot Instances (for non-critical workloads)

```bash
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1d0 \
  --count 1 \
  --instance-type t3.micro \
  --key-name your-key-pair \
  --instance-market-options MarketType=spot
```

### 3. Enable Cost Monitoring

```bash
# Set up billing alerts
aws budgets create-budget \
  --account-id your-account-id \
  --budget '{
    "BudgetName": "ai-chat-rate-limiter-budget",
    "BudgetLimit": {
      "Amount": "50",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }'
```

---

## 🔧 Troubleshooting Deployment Issues

### Common Issues and Solutions

1. **Application not starting**
   ```bash
   # Check logs
   eb logs
   # Or for EC2
   docker logs container-name
   ```

2. **Environment variables not set**
   ```bash
   # Verify environment variables
   eb printenv
   # Or check in container
   docker exec -it container-name env
   ```

3. **Port issues**
   - Ensure application listens on correct port
   - Check security group settings
   - Verify load balancer configuration

4. **Memory issues**
   ```bash
   # Monitor memory usage
   docker stats
   # Increase instance size if needed
   ```

### Health Check Endpoints

Add comprehensive health checks:

```javascript
// Enhanced health check
app.get('/api/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV,
    version: require('./package.json').version
  };
  
  res.json(health);
});
```

---

## 📋 Post-Deployment Checklist

- [ ] Application starts successfully
- [ ] All endpoints respond correctly
- [ ] Rate limiting works for all user types
- [ ] Authentication flow works
- [ ] Environment variables are set
- [ ] SSL certificate is configured
- [ ] Monitoring and logging are active
- [ ] Backup strategy is in place
- [ ] Cost alerts are configured
- [ ] Security groups are properly configured
- [ ] Load testing has been performed

---

## 📞 Support and Maintenance

### Regular Maintenance Tasks

1. **Update dependencies monthly**
   ```bash
   npm audit
   npm update
   ```

2. **Monitor logs for errors**
   ```bash
   aws logs tail /aws/ai-chat-rate-limiter --follow
   ```

3. **Review cost and usage metrics**
   - Check AWS Cost Explorer
   - Monitor CloudWatch metrics

4. **Security updates**
   - Update base Docker images
   - Review security groups
   - Rotate JWT secrets periodically

---

**🎉 Your AI Chat Rate Limiter is now deployed and ready for production use on AWS!**

For additional support, refer to the main README.md file or create an issue in the project repository.
