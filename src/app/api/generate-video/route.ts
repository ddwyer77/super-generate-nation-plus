import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import { Buffer } from "buffer";

// This route uses direct REST calls to Replicate API for video generation

// Define the shape of a Replicate prediction
type ReplicatePrediction = { id: string; status: string; output?: string[] };

// Define the shape for model info response, including default or latest version
type ModelInfo = {
  default_version?: { id?: string };
  latest_version?: { id?: string };
};

export async function POST(request: Request) {
  try {
    // Lazily create Supabase admin client (throws if env vars are missing)
    const supabaseAdmin = getSupabaseAdmin();
    
    // Read inputs from formData
    const formData = await request.formData();
    const promptRaw = formData.get("prompt");
    const frameRaw = formData.get("frame");
    // Read video model ID from formData, fallback to env var
    const modelIdRaw = formData.get("modelId");
    const modelId = typeof modelIdRaw === 'string' && modelIdRaw.trim()
      ? modelIdRaw
      : process.env.KWAIVGI_MODEL_ID;
    if (!modelId) {
      return NextResponse.json({ error: 'Missing modelId' }, { status: 500 });
    }
    console.log(`Using model ID: ${modelId}`);
    
    // Validate inputs
    if (typeof promptRaw !== "string" || !(frameRaw instanceof Blob)) {
      return NextResponse.json({ error: "Missing or invalid prompt/frame" }, { status: 400 });
    }
    const prompt = promptRaw;
    const frameBlob = frameRaw;

    // Convert Blob to Buffer and upload initial frame to Supabase
    const arrayBuffer = await frameBlob.arrayBuffer();
    const contentType = frameBlob.type || "image/png";
    const extension = contentType.split("/")[1] || "png";
    const frameFileName = `${uuidv4()}.${extension}`;
    const framePath = `videos/frames/${frameFileName}`;

    const { error: frameError } = await supabaseAdmin.storage
      .from("videos")
      .upload(framePath, Buffer.from(arrayBuffer), { contentType });
    if (frameError) {
      console.error("Supabase upload frame error:", frameError.message);
      return NextResponse.json({ error: frameError.message }, { status: 500 });
    }

    const { data: { publicUrl: frameUrl } } = supabaseAdmin.storage
      .from("videos")
      .getPublicUrl(framePath);
      
    console.log(`Uploaded frame to: ${frameUrl}`);

    // Invoke the KWAIVGI Kling video model via Replicate REST API
    // 1. Fetch model info to get default version
    const modelRes = await fetch(`https://api.replicate.com/v1/models/${modelId}`, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}` }
    });
    if (!modelRes.ok) {
      const text = await modelRes.text();
      throw new Error(`Failed to fetch model info: ${text}`);
    }
    
    const modelJson: ModelInfo = await modelRes.json();
    
    // Log the model info for debugging
    console.log('Model info received:', JSON.stringify(modelJson, null, 2));
    
    // Determine version ID (prefer default_version, fallback to latest_version)
    let versionId: string | undefined;
    
    if (modelJson.default_version?.id) {
      versionId = modelJson.default_version.id;
      console.log(`Using default version: ${versionId}`);
    } else if (modelJson.latest_version?.id) {
      versionId = modelJson.latest_version.id;
      console.log(`Using latest version: ${versionId}`);
    } else {
      console.error('Model info lacks version ID:', modelJson);
      return NextResponse.json(
        { error: 'Invalid model info - no version ID found', details: modelJson },
        { status: 500 }
      );
    }

    // Determine which input field should receive the first frame.
    let frameField = "image"; // sensible default
    try {
      const inputProps = (modelJson.latest_version as unknown as {
        openapi_schema?: {
          components?: {
            schemas?: { Input?: { properties?: Record<string, unknown> } };
          };
        };
      })?.openapi_schema?.components?.schemas?.Input?.properties ?? {};
      const candidate = Object.keys(inputProps).find((key) => /first_frame|image|frame/i.test(key));
      if (candidate) frameField = candidate;
    } catch {
      console.warn("Could not introspect input fields, falling back to 'image'");
    }

    console.log(`Using frame field '${frameField}' in input`);

    // 2. Create a prediction for video generation
    interface PredictionBody {
      version: string;
      input: Record<string, unknown>;
    }

    const predictionBody: PredictionBody = {
      version: versionId,
      input: {
        [frameField]: frameUrl,
        prompt,
      },
    };
    
    console.log('Sending prediction request with body:', JSON.stringify(predictionBody, null, 2));
    
    const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(predictionBody)
    });
    
    if (!predictionRes.ok) {
      const text = await predictionRes.text();
      throw new Error(`Prediction request failed: ${text}`);
    }
    
    let prediction = await predictionRes.json() as ReplicatePrediction;
    console.log('Initial prediction response:', JSON.stringify(prediction, null, 2));

    // 3. Poll until the prediction finishes
    const pollIntervalMs = 2000; // 2-second polling interval
    const maxWaitMs = Number(process.env.REPLICATE_MAX_WAIT_MS ?? 600000); // default 10 minutes
    const startTime = Date.now();
    
    while (["starting", "processing", "queued"].includes(prediction.status)) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Prediction timed out after ${Math.floor(maxWaitMs / 1000)} seconds`);
      }

      await new Promise(r => setTimeout(r, pollIntervalMs));
      const statusRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}` } }
      );
      
      if (!statusRes.ok) {
        const errorText = await statusRes.text();
        throw new Error(`Failed to get prediction status: ${errorText}`);
      }
      
      prediction = await statusRes.json() as ReplicatePrediction;
      console.log(`Polled prediction status: ${prediction.status}`);
    }
    
    if (prediction.status !== "succeeded" || prediction.output === undefined || prediction.output === null) {
      console.error("Failed prediction:", JSON.stringify(prediction, null, 2));
      return NextResponse.json({ 
        error: `Video generation failed: ${prediction.status}`, 
        details: prediction 
      }, { status: 500 });
    }
    
    const outputUrls: string[] = Array.isArray(prediction.output)
      ? prediction.output
      : [prediction.output as unknown as string];
    console.log(`Received ${outputUrls.length} output URLs:`, outputUrls);

    // Download and re-store each generated video
    const publicVideoUrls: string[] = [];
    for (const url of outputUrls) {
      // Validate that the URL is a proper and complete URL
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        console.error(`Invalid URL received from Replicate: "${url}"`);
        continue;
      }

      try {
        console.log(`Fetching video from: ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`Failed to fetch video from URL: ${url}, status: ${res.status}`);
          continue;
        }

        const buf = await res.arrayBuffer();
        console.log(`Downloaded video buffer of size: ${buf.byteLength} bytes`);
        
        const videoContentType = res.headers.get("content-type") || "video/mp4";
        const videoExt = videoContentType.split("/")[1] || "mp4";
        const videoFileName = `${uuidv4()}.${videoExt}`;
        const videoPath = `videos/${videoFileName}`;

        const { error } = await supabaseAdmin.storage
          .from("videos")
          .upload(videoPath, Buffer.from(buf), { contentType: videoContentType });
        if (error) {
          console.error("Supabase video upload error:", error.message);
          continue;
        }

        const { data: { publicUrl } } = supabaseAdmin.storage
          .from("videos")
          .getPublicUrl(videoPath);
          
        console.log(`Stored video at: ${publicUrl}`);
        publicVideoUrls.push(publicUrl);
      } catch (fetchError) {
        console.error(`Error processing video URL ${url}:`, fetchError);
        continue;
      }
    }

    if (publicVideoUrls.length === 0) {
      throw new Error("Failed to process any valid video URLs from the model output");
    }

    console.log(`Returning ${publicVideoUrls.length} video URLs`);
    return NextResponse.json({ videos: publicVideoUrls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 