#!/bin/bash

# Interview System Setup Script
# This script sets up both the frontend and backend services

echo "🚀 Interview System Setup"
echo "========================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis is not installed. Installing with Homebrew..."
    if command -v brew &> /dev/null; then
        brew install redis
        brew services start redis
    else
        echo "❌ Please install Redis manually:"
        echo "   macOS: brew install redis"
        echo "   Ubuntu: sudo apt-get install redis-server"
        echo "   Windows: Download from https://redis.io/download"
        exit 1
    fi
fi

# Setup Backend
echo "📦 Setting up backend server..."
cd server

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Install Playwright browsers
echo "Installing Playwright browsers (this may take a few minutes)..."
npx playwright install chromium

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it to add your API keys."
fi

# Return to root
cd ..

# Setup Frontend
echo ""
echo "📦 Setting up frontend..."

# Install frontend dependencies
npm install

# Create frontend .env if needed
if [ ! -f .env ]; then
    echo "REACT_APP_API_URL=http://localhost:3001" > .env
    echo "✅ Created frontend .env file"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit server/.env to add your API keys (GLM API key required)"
echo "2. Start Redis if not running: redis-server"
echo "3. Start the backend: cd server && npm run dev"
echo "4. Start the frontend (in a new terminal): npm start"
echo "5. Access the app at http://localhost:3000"
echo ""
echo "🔧 Backend API will be available at http://localhost:3001"
echo "📚 API Documentation:"
echo "   - Health Check: GET /api/health"
echo "   - Crawl Questions: POST /api/interview/crawl"
echo "   - Get Categories: GET /api/interview/categories"
echo "   - Get Sites: GET /api/interview/sites"