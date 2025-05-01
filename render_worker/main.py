import subprocess
import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pathlib import Path
import os
from supabase import create_client

app = FastAPI()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    raise RuntimeError("Supabase credentials not set in env vars")

db = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

class VideoRequest(BaseModel):
    src_url: str
    user_id: str
    grain: float = 0.6
    contrast: float = 2.2
    glitch: float = 0.3
    scan: float = 0.2

VIDEO_DIR = Path("/tmp/videos")
VIDEO_DIR.mkdir(exist_ok=True, parents=True)

PY_PROC = Path("/var/python/video_corruptor.py")

@app.post("/process")
async def process_video(req: VideoRequest):
    # Download video
    input_path = VIDEO_DIR / f"input_{uuid.uuid4()}.mp4"
    output_path = VIDEO_DIR / f"output_{uuid.uuid4()}.mp4"

    try:
        import requests
        resp = requests.get(req.src_url)
        resp.raise_for_status()
        input_path.write_bytes(resp.content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Download failed: {e}")

    # Run ffmpeg pipeline via python script
    try:
        proc = subprocess.run([
            "python3", str(PY_PROC), str(input_path), str(output_path),
            "--grain", str(req.grain), "--contrast", str(req.contrast),
            "--glitch", str(req.glitch), "--scan", str(req.scan)
        ], capture_output=True, text=True, timeout=600)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {e}")

    # Read processed video and upload to Storage
    try:
        video_data = output_path.read_bytes()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reading output failed: {e}")

    file_name = f"grain_{uuid.uuid4()}.mp4"
    bucket_name = "corrupted"
    upload_res = db.storage.from_(bucket_name).upload(file_name, video_data, {'contentType': 'video/mp4'})
    if upload_res.get('error'):
        raise HTTPException(status_code=500, detail=f"Upload failed: {upload_res['error']}")

    public_url = db.storage.from_(bucket_name).get_public_url(file_name)['data']['publicUrl']

    # Insert db row
    db.from_('generated_media').insert({
        'user_id': req.user_id,
        'url': public_url,
        'type': 'video'
    }).execute()

    return {
        "url": public_url
    } 