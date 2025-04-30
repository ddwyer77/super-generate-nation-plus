import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import { Buffer } from "buffer";

// Use Replicate REST API directly for model/version control
type ReplicateInput = { prompt: string; modelId?: string };
type ModelInfo = { default_version?: { id?: string }; latest_version?: { id?: string } };

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { prompt, modelId } = (await request.json()) as ReplicateInput;
    if (!prompt) {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Determine which model to use
    const DEFAULT_MODEL_ID = process.env.FLUX_MODEL_ID!;
    let selectedModel = modelId?.trim() ? modelId : DEFAULT_MODEL_ID;

    // 1) Fetch model info for version
    let modelRes = await fetch(`https://api.replicate.com/v1/models/${selectedModel}`, {
      headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}` }
    });
    // Fallback to default if custom model is not found
    if (!modelRes.ok && modelRes.status === 404 && selectedModel !== DEFAULT_MODEL_ID) {
      console.warn(`Model ${selectedModel} not found (404). Falling back to default model ${DEFAULT_MODEL_ID}`);
      selectedModel = DEFAULT_MODEL_ID;
      modelRes = await fetch(`https://api.replicate.com/v1/models/${selectedModel}`, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}` }
      });
    }
    if (!modelRes.ok) {
      const text = await modelRes.text();
      return NextResponse.json({ error: `Image model not found: ${selectedModel}`, details: text }, { status: modelRes.status });
    }
    const modelJson = (await modelRes.json()) as ModelInfo;
    const versionId = modelJson.default_version?.id ?? modelJson.latest_version?.id;
    if (!versionId) {
      return NextResponse.json({ error: `Invalid model info for: ${selectedModel}`, details: modelJson }, { status: 500 });
    }

    // 2) Create a prediction via REST
    const predictionRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ version: versionId, input: { prompt } })
    });
    if (!predictionRes.ok) {
      const text = await predictionRes.text();
      return NextResponse.json({ error: `Prediction request failed: ${text}` }, { status: 500 });
    }
    let prediction = (await predictionRes.json()) as { id: string; status: string; output?: string | string[] };

    // 3) Poll until completion or timeout
    const startTime = Date.now();
    const pollIntervalMs = 2000;
    const maxWaitMs = Number(process.env.REPLICATE_MAX_WAIT_MS ?? 600000);
    while (["starting", "processing", "queued"].includes(prediction.status)) {
      if (Date.now() - startTime > maxWaitMs) {
        return NextResponse.json({ error: `Image generation timed out after ${Math.floor(maxWaitMs/1000)}s` }, { status: 500 });
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
      const statusRes = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        { headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN!}` } }
      );
      if (!statusRes.ok) {
        const text = await statusRes.text();
        return NextResponse.json({ error: `Failed to get prediction status: ${text}` }, { status: 500 });
      }
      prediction = (await statusRes.json()) as typeof prediction;
    }
    if (prediction.status !== "succeeded" || !prediction.output) {
      return NextResponse.json({ error: `Image generation failed: ${prediction.status}`, details: prediction }, { status: 500 });
    }
    const outputUrls = Array.isArray(prediction.output)
      ? prediction.output
      : [prediction.output as string];

    const publicUrls: string[] = [];
    for (const url of outputUrls) {
      // Download the generated image
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "image/png";
      const extension = contentType.split("/")[1] || "png";
      const fileName = `${uuidv4()}.${extension}`;
      const filePath = `images/${fileName}`;

      // Upload to Supabase storage bucket 'images'
      const { error } = await supabaseAdmin.storage
        .from("images")
        .upload(filePath, Buffer.from(arrayBuffer), { contentType });
      if (error) {
        console.error("Supabase upload error:", error.message);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabaseAdmin.storage.from("images").getPublicUrl(filePath);
      publicUrls.push(publicUrl);
    }

    return NextResponse.json({ images: publicUrls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 