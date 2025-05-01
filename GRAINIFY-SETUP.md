# Grainify Setup Guide

This guide walks you through setting up the Grainify video effect tool with Supabase Edge Functions.

## Prerequisites

1. **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop/)
2. **Supabase Account** - You need a Supabase account with Edge Functions enabled (Pro plan)
3. **Supabase CLI** - Will be installed automatically by the script if needed

## One-Click Setup

We've created a simple script to handle the entire deployment process:

```bash
# Make the script executable if needed
chmod +x deploy-grainify.sh

# Run the deployment script
./deploy-grainify.sh
```

When prompted, enter your Supabase project reference: `zxucfvfjnksqmnrdfakx`

The script will:
1. Check if Docker is running
2. Build the Ubuntu-based Docker container with Python and FFmpeg
3. Deploy to your Supabase project
4. Ensure all required storage buckets exist
5. Provide testing instructions

## Technical Details

The Grainify feature uses:
- **Ubuntu-based Docker container** for reliable FFmpeg support
- **Python script** (`video_corruptor.py`) for applying video effects
- **Supabase Storage** for handling input/output videos
- **Supabase Edge Functions** for serverless processing

## Manual Setup (if script fails)

If you need to manually deploy:

```bash
# Navigate to the function directory
cd supabase/functions/grainify

# Build the Docker image
docker build -t grainifier-edge-function .

# Deploy to Supabase
supabase functions deploy grainify --project-ref zxucfvfjnksqmnrdfakx --no-verify-jwt
```

## Troubleshooting

1. **Docker errors**: Make sure Docker Desktop is running
2. **Missing Python/FFmpeg**: The Ubuntu-based Dockerfile ensures these are properly installed
3. **Path issues**: The Dockerfile and Edge Function are configured to use the correct paths
4. **Storage buckets**: Make sure you have "corrupted" and "videos" buckets in your Supabase storage

## Testing the Function

After deployment, test your function with:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"url":"YOUR_VIDEO_URL", "userId":"YOUR_USER_ID"}' \
  https://zxucfvfjnksqmnrdfakx.supabase.co/functions/v1/grainify
```

Replace:
- `YOUR_VIDEO_URL` with a publicly accessible video URL
- `YOUR_USER_ID` with a valid user ID from your auth system 