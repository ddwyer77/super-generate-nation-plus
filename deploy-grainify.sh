#!/bin/bash
# Simple deployment script for Grainify Edge Function

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop first."
  exit 1
fi

echo "🚀 Deploying Grainify Edge Function..."

# Navigate to the function directory
cd supabase/functions/grainify

# Build the Docker image
echo "🔨 Building Docker image..."
docker build -t grainifier-edge-function .

if [ $? -ne 0 ]; then
  echo "❌ Docker build failed. Please check the error messages above."
  exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "⚠️ Supabase CLI not found, installing..."
  npm install -g supabase
fi

# Prompt for the project reference
read -p "Enter your Supabase project reference (from the URL, e.g. abcdefghijklmnopqrst): " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
  echo "❌ Project reference is required."
  exit 1
fi

# Login to Supabase if needed
echo "🔑 Checking Supabase login status..."
supabase projects list > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️ Not logged in to Supabase. Please login:"
  supabase login
  
  if [ $? -ne 0 ]; then
    echo "❌ Login failed. Please try again."
    exit 1
  fi
fi

# Deploy the function
echo "📦 Deploying to Supabase..."
supabase functions deploy grainify --project-ref "$PROJECT_REF" --no-verify-jwt

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed. Please check the error messages above."
  exit 1
fi

# Create required storage buckets if they don't exist
echo "📂 Checking storage buckets..."
curl -s "https://$PROJECT_REF.supabase.co/functions/v1/check-buckets" > /dev/null

echo "✅ Grainify Edge Function deployed successfully!"
echo "🔗 Your function is now available at: https://$PROJECT_REF.supabase.co/functions/v1/grainify"
echo ""
echo "Test it with:"
echo "curl -X POST -H \"Content-Type: application/json\" -d '{\"url\":\"YOUR_VIDEO_URL\", \"userId\":\"YOUR_USER_ID\"}' https://$PROJECT_REF.supabase.co/functions/v1/grainify" 