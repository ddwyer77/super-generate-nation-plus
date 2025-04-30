// @ts-nocheck
import { NextResponse } from 'next/server';
import { tmpName } from 'tmp-promise';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json() as { url: string; userId: string };
    if (!body.url || !body.userId) return NextResponse.json({ error: 'Missing url/userId' }, { status: 400 });

    // download source video
    const inputPath = await tmpName({ postfix: '.mp4' });
    const outputPath = await tmpName({ postfix: '.mp4' });

    const resp = await fetch(body.url);
    if (!resp.ok) throw new Error('Failed to download source');
    const buf = Buffer.from(await resp.arrayBuffer());
    await fs.writeFile(inputPath, buf);

    // run python script
    await new Promise((res, rej) => {
      const p = spawn('python3', ['python/video_corruptor.py', inputPath, outputPath], { stdio: 'inherit' });
      p.on('exit', code => code === 0 ? res(true) : rej(new Error('Grainify failed')));
    });

    const outBuf = await fs.readFile(outputPath);
    const fileName = `grain_${Date.now()}.mp4`;
    const { error } = await supabase.storage.from('corrupted').upload(fileName, outBuf, { contentType: 'video/mp4' });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('corrupted').getPublicUrl(fileName);

    // add to media table
    await supabase.from('generated_media').insert({ user_id: body.userId, url: publicUrl, type: 'video' });

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
} 