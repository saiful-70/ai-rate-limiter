#!/bin/bash

# Test script for the updated Vercel AI Rate Limiter
echo "🚀 Testing AI Chat Rate Limiter with Vercel Provider"
echo "=================================================="

BASE_URL="http://localhost:3000"

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "${BASE_URL}/" | python3 -m json.tool
echo ""

# Test 2: Login as free user
echo "2. Getting user token (free user)..."
TOKEN=$(curl -s -X POST "${BASE_URL}/api/login" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "userType": "free"}' | \
  python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")
echo "Token: ${TOKEN}"
echo ""

# Test 3: Check rate limit status
echo "3. Checking rate limit status..."
curl -s -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/status" | python3 -m json.tool
echo ""

# Test 4: Send chat messages (should use mock since no real API key)
echo "4. Sending chat messages..."
for i in {1..3}; do
  echo "Message ${i}:"
  curl -s -X POST "${BASE_URL}/api/chat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"message": "Hello! This is test message '${i}'", "model": "v0-1.5-md"}' | python3 -m json.tool
  echo ""
done

# Test 5: Check available models
echo "5. Checking available Vercel models..."
curl -s -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/chat/models" | python3 -m json.tool
echo ""

# Test 6: Try to exceed rate limit
echo "6. Testing rate limit (attempting to exceed free user limit)..."
for i in {4..12}; do
  echo "Message ${i} (should hit rate limit soon):"
  RESPONSE=$(curl -s -X POST "${BASE_URL}/api/chat" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"message": "Rate limit test message '${i}'", "model": "v0-1.5-md"}')
  echo "${RESPONSE}" | python3 -m json.tool
  
  # Check if we hit the rate limit
  if echo "${RESPONSE}" | grep -q "Too many requests"; then
    echo "✅ Rate limit working correctly!"
    break
  fi
  echo ""
done

echo "🎉 Test completed!"
