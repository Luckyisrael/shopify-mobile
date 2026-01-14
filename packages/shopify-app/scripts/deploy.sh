#!/bin/bash

# Production deployment script
set -e

echo "🚀 Starting production deployment..."

# Check required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is required"
    exit 1
fi

if [ -z "$SHOPIFY_API_KEY" ]; then
    echo "❌ SHOPIFY_API_KEY is required"
    exit 1
fi

if [ -z "$SHOPIFY_API_SECRET" ]; then
    echo "❌ SHOPIFY_API_SECRET is required"
    exit 1
fi

echo "✅ Environment variables validated"

# Run database migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Build the application
echo "🏗️ Building application..."
npm run build

# Start the application
echo "🎉 Starting production server..."
npm run start