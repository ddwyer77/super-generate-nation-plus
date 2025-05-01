import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRole);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json'
};

serve(async (_req) => {
  try {
    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) throw error;
    
    console.log('Existing buckets:', buckets.map(b => b.name).join(', '));
    
    // Required buckets for the application
    const requiredBuckets = ['corrupted', 'videos'];
    const bucketsToCreate = [];
    
    for (const bucketName of requiredBuckets) {
      if (!buckets.some(b => b.name === bucketName)) {
        bucketsToCreate.push(bucketName);
      }
    }
    
    // Create missing buckets
    for (const bucketName of bucketsToCreate) {
      console.log(`Creating bucket: ${bucketName}`);
      const { error } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
      });
      
      if (error) {
        console.error(`Failed to create bucket ${bucketName}:`, error);
      } else {
        console.log(`Successfully created bucket: ${bucketName}`);
      }
    }
    
    return new Response(JSON.stringify({
      buckets: buckets.map(b => b.name),
      created: bucketsToCreate
    }), { headers: corsHeaders });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}); 