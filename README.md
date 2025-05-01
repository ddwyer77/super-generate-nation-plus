# Super Generate Nation Plus

A media generation application with image and video creation capabilities powered by Supabase and Replicate's AI models.

## Grainifier Module with Custom Docker Container

To deploy the grainifier Edge Function with Python and FFmpeg, follow these steps:

1. **Build and setup the container configuration:**

```bash
# Ensure Docker is running locally
docker --version

# Build the Docker image defined in build/Dockerfile
cd supabase/functions/grainify
docker build -t grainifier-edge-function -f build/Dockerfile .
```

2. **Set up your Supabase project for containerized functions:**

This requires the Supabase Pro plan with the Container Functions feature. You'll need to update your project settings in the Supabase dashboard to enable container functions.

3. **Deploy the containerized Edge Function:**

```bash
# Deploy using the container.json configuration
supabase functions deploy grainify --project-ref YOUR_PROJECT_REF --no-verify-jwt

# Test the function
curl -H "Content-Type: application/json" \
     -d '{"url":"https://example.com/video.mp4", "userId":"test"}' \
     "https://YOUR_PROJECT_REF.supabase.co/functions/v1/grainify"
```

4. **Using the Function through the UI:**

The front-end application already includes integration with the grainifier Edge Function. Just sign in, upload a video, and use the "Grainify It" button to apply effects.

## Features

- Image generation using Replicate's Flux model
- Video generation using Kling model 
- User authentication and media library
- Grainifier module for applying retro effects to videos
- Direct video upload capabilities

## Development

```bash
# Install dependencies
npm install

# Run the development server with environment variables
doppler run -- npm run dev
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
