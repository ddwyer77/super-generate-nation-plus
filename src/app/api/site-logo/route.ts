import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";

export async function GET() {
  try {
    // Initialize Supabase admin client and fetch public URL
    const supabaseAdmin = getSupabaseAdmin();
    const { data } = supabaseAdmin.storage
      .from("site-assets")
      .getPublicUrl("graincore.png");
    return NextResponse.json({ url: data.publicUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 