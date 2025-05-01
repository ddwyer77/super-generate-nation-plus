// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.5';
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { basename, join } from 'https://deno.land/std@0.192.0/path/mod.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceRole);

// Configure CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    // Parse request body
    const requestBody = await req.json().catch(err => {
      console.error('Failed to parse request body:', err);
      throw new Error('Invalid JSON in request body');
    });
    
    console.log('Original request body:', JSON.stringify(requestBody));

    // Handle both direct requests and requests from supabaseBrowser.functions.invoke()
    // which wraps the payload in a "body" property
    const actualRequestBody = requestBody.body || requestBody;
    
    console.log('Processed request body:', JSON.stringify(actualRequestBody));
    
    const { url, userId, grain = 0.6, contrast = 2.2, glitch = 0.3, scan = 0.2 } = actualRequestBody;
    
    if (!url || !userId) {
      return new Response(JSON.stringify({ error: 'Missing url/userId' }), { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log(`Processing video with params: grain=${grain}, contrast=${contrast}, glitch=${glitch}, scan=${scan}`);
    console.log(`Source URL: ${url}`);

    // 1. Download source video to tmp
    console.log('Downloading source video...');
    const resp = await fetch(url);
    if (!resp.ok) {
      console.error(`Failed to fetch source video: ${resp.status} ${resp.statusText}`);
      throw new Error(`Failed to fetch source video: ${resp.status} ${resp.statusText}`);
    }

    const inputPath = join('/tmp', basename(url.split('?')[0]));
    const fileBuf = new Uint8Array(await resp.arrayBuffer());
    await Deno.writeFile(inputPath, fileBuf);
    console.log(`Downloaded to ${inputPath}`);

    // 2. Run python script (requires python & ffmpeg layer on Edge runtime)
    console.log('Running video processing script...');
    const outputPath = join('/tmp', `grain_${crypto.randomUUID()}.mp4`);
    
    try {
      // Check if Python is available
      try {
        const pythonCheck = Deno.run({
          cmd: ['python3', '--version'],
          stdout: 'piped',
          stderr: 'piped'
        });
        const pythonStatus = await pythonCheck.status();
        const pythonOutput = new TextDecoder().decode(await pythonCheck.output());
        console.log(`Python check: ${pythonStatus.success ? 'OK' : 'Failed'}, ${pythonOutput.trim()}`);
        pythonCheck.close();
        
        // Check FFmpeg as well
        const ffmpegCheck = Deno.run({
          cmd: ['ffmpeg', '-version'],
          stdout: 'piped',
          stderr: 'piped'
        });
        const ffmpegStatus = await ffmpegCheck.status();
        const ffmpegOutput = new TextDecoder().decode(await ffmpegCheck.output());
        console.log(`FFmpeg check: ${ffmpegStatus.success ? 'OK' : 'Failed'}, ${ffmpegOutput.split('\n')[0]}`);
        ffmpegCheck.close();
        
        // Continue with normal processing path
      } catch (err) {
        console.error('Python check error:', err);
        // If Python is not available, we need to mock the response for development purposes
        console.log('DEVELOPMENT MODE: Python is not available in Edge Runtime, returning mock response');
        
        // Generate a mock video URL - in production this would be a real processed video
        const mockPublicUrl = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        
        return new Response(JSON.stringify({ 
          url: mockPublicUrl,
          warning: 'This is a mock response. The video was not actually processed as Python/FFmpeg are not available in the Edge Runtime.'
        }), { 
          headers: corsHeaders 
        });
      }
      
      // List files in the python directory
      try {
        console.log('Looking for Python script...');
        const files = [...Deno.readDirSync('python')].map(f => f.name);
        console.log('Python directory contents:', files);
      } catch (err) {
        console.error('Failed to list Python directory:', err);
      }

      // Check if the Python script exists
      try {
        console.log('Looking for Python script at /var/python/video_corruptor.py...');
        const scriptStats = await Deno.stat('/var/python/video_corruptor.py');
        console.log('Python script found:', scriptStats.isFile);
      } catch (err) {
        console.error('Python script check error:', err);
      }

      console.log('Starting Python process with absolute path...');
      const p = Deno.run({
        cmd: [
          'python3',
          '/var/python/video_corruptor.py', // Use absolute path
          inputPath,
          outputPath,
          '--grain', String(grain),
          '--contrast', String(contrast),
          '--glitch', String(glitch),
          '--scan', String(scan),
        ],
        stdout: 'piped',
        stderr: 'piped',
        env: {
          "PATH": "/usr/bin:/bin:/usr/local/bin:/root/.deno/bin" // Ensure FFmpeg is in PATH
        }
      });
      
      const status = await p.status();
      
      // Capture output for debugging
      const output = new TextDecoder().decode(await p.output());
      const stderrOutput = new TextDecoder().decode(await p.stderrOutput());
      
      p.close();
      
      if (!status.success) {
        console.error('Process execution failed:', stderrOutput);
        throw new Error(`Grainify subprocess failed: ${stderrOutput}`);
      }
      
      console.log('Process output:', output);
    } catch (err) {
      console.error('Error running python script:', err);
      throw new Error(`Failed to run video processor: ${err.message}`);
    }

    console.log(`Processing complete. Output at: ${outputPath}`);

    // 3. Upload to Supabase Storage (bucket: corrupted)
    console.log('Uploading processed video to storage...');
    let videoBuf;
    try {
      videoBuf = await Deno.readFile(outputPath);
    } catch (err) {
      console.error('Error reading output file:', err);
      throw new Error(`Failed to read processed video: ${err.message}`);
    }
    
    const fileName = `grain_${Date.now()}.mp4`;
    const { error } = await supabase.storage.from('corrupted').upload(fileName, videoBuf, {
      contentType: 'video/mp4',
      upsert: false,
    });
    
    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }
    
    console.log(`Uploaded to storage as: ${fileName}`);
    
    const { data: { publicUrl } } = supabase.storage.from('corrupted').getPublicUrl(fileName);
    console.log(`Public URL: ${publicUrl}`);

    // 4. Insert into generated_media table
    console.log('Adding record to database...');
    const { error: dbError } = await supabase.from('generated_media').insert({ 
      user_id: userId, 
      url: publicUrl, 
      type: 'video' 
    });
    
    if (dbError) {
      console.error('Database insert error:', dbError);
      throw dbError;
    }
    
    console.log('Processing successful!');
    return new Response(JSON.stringify({ url: publicUrl }), { 
      headers: corsHeaders 
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Error in grainify function:', msg);
    return new Response(JSON.stringify({ error: msg }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}); 