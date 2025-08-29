#!/bin/bash

# AI Chat Rate Limiter - Test Examples
# This script demonstrates how the rate limiter works for different user types

API_URL="http://localhost:3000/api"

echo "🚀 AI Chat Rate Limiter - Test Examples"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API requests and display results
make_request() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-""}
    local auth_header=${4:-""}
    
    if [ -n "$auth_header" ]; then
        if [ -n "$data" ]; then
            response=$(curl -s -X $method "$API_URL$endpoint" -H "Content-Type: application/json" -H "Authorization: Bearer $auth_header" -d "$data")
        else
            response=$(curl -s -X $method "$API_URL$endpoint" -H "Authorization: Bearer $auth_header")
        fi
    else
        if [ -n "$data" ]; then
            response=$(curl -s -X $method "$API_URL$endpoint" -H "Content-Type: application/json" -d "$data")
        else
            response=$(curl -s -X $method "$API_URL$endpoint")
        fi
    fi
    
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    echo ""
}

echo -e "${BLUE}1. Getting Demo User Information${NC}"
echo "GET /api/auth/users"
make_request "/auth/users"

echo -e "${BLUE}2. Testing Guest User Rate Limiting (3 requests/hour)${NC}"
echo "Making 4 requests as guest user (no authentication)..."
for i in {1..4}; do
    echo -e "${YELLOW}Request $i:${NC}"
    make_request "/chat" "POST" '{"message": "Hello from guest user, request '$i'"}'
    sleep 1
done

echo -e "${BLUE}3. Login as Free User${NC}"
echo "POST /api/auth/login"
login_response=$(curl -s -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d '{"username": "freeuser", "password": "password123"}')
free_token=$(echo "$login_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -n "$free_token" ]; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    echo "$login_response" | python3 -m json.tool
    echo ""
    
    echo -e "${BLUE}4. Testing Free User Rate Limiting (10 requests/hour)${NC}"
    echo "Making 12 requests as free user..."
    for i in {1..12}; do
        echo -e "${YELLOW}Request $i:${NC}"
        make_request "/chat" "POST" '{"message": "Hello from free user, request '$i'"}' "$free_token"
        sleep 0.5
    done
else
    echo -e "${RED}❌ Login failed${NC}"
    echo "$login_response"
fi

echo -e "${BLUE}5. Login as Premium User${NC}"
echo "POST /api/auth/login"
premium_login_response=$(curl -s -X POST "$API_URL/auth/login" -H "Content-Type: application/json" -d '{"username": "premiumuser", "password": "password123"}')
premium_token=$(echo "$premium_login_response" | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])" 2>/dev/null)

if [ -n "$premium_token" ]; then
    echo -e "${GREEN}✅ Login successful!${NC}"
    echo "$premium_login_response" | python3 -m json.tool
    echo ""
    
    echo -e "${BLUE}6. Testing Premium User Rate Limiting (50 requests/hour)${NC}"
    echo "Making 10 requests as premium user (should all succeed)..."
    for i in {1..10}; do
        echo -e "${YELLOW}Request $i:${NC}"
        make_request "/chat" "POST" '{"message": "Hello from premium user, request '$i'"}' "$premium_token"
        sleep 0.3
    done
else
    echo -e "${RED}❌ Premium login failed${NC}"
    echo "$premium_login_response"
fi

echo -e "${BLUE}7. Checking Rate Limit Status${NC}"
if [ -n "$free_token" ]; then
    echo "Free user status:"
    make_request "/status" "GET" "" "$free_token"
fi

if [ -n "$premium_token" ]; then
    echo "Premium user status:"
    make_request "/status" "GET" "" "$premium_token"
fi

echo "Guest user status (no auth):"
make_request "/status"

echo -e "${BLUE}8. Getting Rate Limits Configuration${NC}"
echo "GET /api/limits"
make_request "/limits"

echo -e "${BLUE}9. Health Check${NC}"
echo "GET /api/health"
make_request "/health"

echo -e "${GREEN}✅ Test completed!${NC}"
echo ""
echo "Summary:"
echo "- Guest users: 3 requests/hour (tracked by IP)"
echo "- Free users: 10 requests/hour (tracked by user ID)"
echo "- Premium users: 50 requests/hour (tracked by user ID)"
echo "- Rate limiting uses Fixed Window algorithm (1-hour windows)"
echo "- Requests are blocked BEFORE calling AI to save costs"
