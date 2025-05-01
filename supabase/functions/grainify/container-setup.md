# Grainifier Edge Function Containerized Deployment

This document explains how to deploy the grainifier feature as a containerized Supabase Edge Function with Python and FFmpeg capabilities using an Ubuntu-based Docker image.

## Prerequisites

- Docker installed and running
- AWS CLI configured (if using AWS ECR)
- Supabase CLI installed
- Supabase Pro account with containerized functions support

## Container Architecture

- **Base Image**: Ubuntu (previously Alpine)
- **Runtime**: Python 3 with FFmpeg
- **Benefits**: Better compatibility with FFmpeg and Python dependencies

## Steps Completed

1. **Docker Image Built**
   - Used the Dockerfile to create an Ubuntu-based containerized environment
   - Installed Python 3 and FFmpeg in the container
   - Configured proper paths for video processing

2. **Container Configuration**
   - Modified deployment scripts to use the local Docker build process
   - Updated resource configurations (memory and CPU limits)
   - Ensured all dependencies are properly installed in the container

## Deployment Process

To deploy the function:

1. **Build the Docker Image**
   ```bash
   cd supabase/functions/grainify
   docker build -t grainifier-edge-function .
   ```

2. **Deploy to Supabase**
   ```bash
   # Use the deployment script
   ./deploy-grainify.sh
   
   # Or deploy manually
   supabase functions deploy grainify --project-ref zxucfvfjnksqmnrdfakx --no-verify-jwt
   ```

3. **Verify Deployment**
   ```bash
   # Test the function with a real video URL
   curl -H "Content-Type: application/json" \
        -d '{"url":"https://example.com/real-video.mp4", "userId":"test-user"}' \
        "https://zxucfvfjnksqmnrdfakx.supabase.co/functions/v1/grainify"
   ```

## Troubleshooting

- If the function fails, check the Supabase Function logs
- Ensure Docker is running before attempting deployment
- Verify that FFmpeg is accessible in the container path
- Check that storage buckets "corrupted" and "videos" exist in your Supabase project

## Next Steps

To complete the deployment:

1. **Push to Container Registry**
   ```bash
   # Authenticate with AWS ECR (example)
   aws ecr get-login-password --region us-west-1 | docker login --username AWS --password-stdin 288116369351.dkr.ecr.us-west-1.amazonaws.com
   
   # Create the repository if it doesn't exist
   aws ecr create-repository --repository-name grainifier-edge-function
   
   # Push the image
   docker push 288116369351.dkr.ecr.us-west-1.amazonaws.com/grainifier-edge-function:latest
   ```

2. **Deploy to Supabase**
   ```bash
   # Deploy the function with the container configuration
   supabase functions deploy grainify --project-ref zxucfvfjnksqmnrdfakx --no-verify-jwt
   ```

3. **Verify Deployment**
   ```bash
   # Test the function with a real video URL
   curl -H "Content-Type: application/json" \
        -d '{"body":{"url":"https://example.com/real-video.mp4", "userId":"test-user"}}' \
        "https://zxucfvfjnksqmnrdfakx.supabase.co/functions/v1/grainify"
   ```

## Troubleshooting

- If the container fails to run, check the Supabase Function logs
- Ensure the container registry is publicly accessible or properly authenticated
- Verify that the paths in `container.json` match those in your container image 