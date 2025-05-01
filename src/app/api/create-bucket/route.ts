import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function POST() {
  try {
    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    
    // Create necessary buckets if they don't exist
    const bucketsToCreate = ['videos', 'corrupted'];
    
    for (const bucketName of bucketsToCreate) {
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
      
      if (listError) {
        console.error('Error listing buckets:', listError.message);
        return NextResponse.json({ error: listError.message }, { status: 500 });
      }
      
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        // Create the bucket
        const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: true, // Make it publicly accessible
          fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        });
        
        if (createError) {
          console.error(`Error creating bucket ${bucketName}:`, createError.message);
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }
        
        console.log(`Created bucket: ${bucketName}`);
      } else {
        console.log(`Bucket already exists: ${bucketName}`);
      }
    }
    
    return NextResponse.json({ success: true, message: "Storage buckets verified" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error in create-bucket API:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 