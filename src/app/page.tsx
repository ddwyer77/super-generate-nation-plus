"use client";
import React, { useState, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import type { Session } from '@supabase/supabase-js';

// Define error log type
type ErrorLog = { id: string; flow: 'image' | 'video'; time: string; message: string; status?: number; details?: unknown; };

// Define API response types
type ImageApiData = { images: string[]; error?: string };
type VideoApiData = { videos: string[]; error?: string };

// Designer Spinner for load states
function Spinner({ className = "h-5 w-5", color = "text-blue-500" }: { className?: string; color?: string }) {
  return (
    <svg className={`animate-spin ${color} ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

const IMAGE_MODELS = [
  { id: process.env.NEXT_PUBLIC_DEFAULT_IMAGE_MODEL_ID || '', name: 'Default Image Model' },
  { id: 'prunaai/hidream-l1-fast', name: 'HiDream L1 Fast' },
];
const VIDEO_MODELS = [
  { id: process.env.NEXT_PUBLIC_DEFAULT_VIDEO_MODEL_ID || '', name: 'Default Video Model' },
  { id: 'wavespeedai/wan-2.1-i2v-480p', name: 'WAN 2.1 i2v 480p' },
];

export default function Home() {
  const [imagePrompt, setImagePrompt] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageLoading, setImageLoading] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);

  const [videoPrompt, setVideoPrompt] = useState("");
  const [frameFile, setFrameFile] = useState<File | null>(null);
  const [videos, setVideos] = useState<string[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);

  const [imageModel, setImageModel] = useState<string>(IMAGE_MODELS[0].id);
  const [videoModel, setVideoModel] = useState<string>(VIDEO_MODELS[0].id);

  // Auth session state
  const [session, setSession] = useState<Session | null>(null);
  const [libraryImages, setLibraryImages] = useState<string[]>([]);
  const [libraryVideos, setLibraryVideos] = useState<string[]>([]);

  const [showAuth, setShowAuth] = useState(false);

  const [activeTab, setActiveTab] = useState<'home'|'library'|'grainify'>('home');

  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [grainLoading, setGrainLoading] = useState(false);

  useEffect(() => {
    // Initialize session
    supabaseBrowser.auth.getSession().then(({ data: { session } }) => setSession(session));
    // Subscribe to auth state changes
    const { data: listener } = supabaseBrowser.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => { listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    const fetchLibrary = async () => {
      const { data: rows, error } = await supabaseBrowser
        .from('generated_media')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (!error && rows) {
        const imgs = rows.filter(r=>r.type==='image').map(r=>r.url);
        const vids = rows.filter(r=>r.type==='video').map(r=>r.url);
        setLibraryImages(imgs);
        setLibraryVideos(vids);
      }
    };
    fetchLibrary();
  }, [session]);

  // State for logo URL fetched from our new API
  const [logoUrl, setLogoUrl] = useState<string>('');
  useEffect(() => {
    fetch('/api/site-logo')
      .then(res => res.json())
      .then(data => data.url && setLogoUrl(data.url))
      .catch(err => console.error('Error fetching logo URL:', err));
  }, []);

  const handleImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImageLoading(true);
    setImages([]);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt, modelId: imageModel }),
      });
      const status = res.status;
      // Read raw body text via clone to avoid consuming the original stream twice
      const raw = await res.clone().text();
      let data: ImageApiData;
      try {
        data = JSON.parse(raw) as ImageApiData;
      } catch {
        throw { msg: 'Invalid JSON', status, details: raw };
      }
      if (!res.ok || data.error) {
        throw { msg: data.error ?? `HTTP ${status}`, status, details: raw };
      }
      setImages(data.images);
      if (session) {
        const inserts = data.images.map((url) => ({ user_id: session.user.id, url, type: 'image' }));
        await supabaseBrowser.from('generated_media').insert(inserts);
        setLibraryImages(prev => [...inserts.map(i=>i.url), ...prev]);
      }
    } catch (err: unknown) {
      console.error(err);
      // Normalize error object
      const errorObj = err as { msg?: string; message?: string; status?: number; details?: unknown };
      const id = uuidv4();
      const time = new Date().toLocaleString();
      const message = errorObj.msg ?? errorObj.message ?? String(err);
      const status = errorObj.status;
      const details = errorObj.details;
      setErrorLogs(prev => [...prev, { id, flow: 'image', time, message, status, details }]);
    } finally {
      setImageLoading(false);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frameFile) {
      alert("Please select a frame image to start");
      return;
    }
    setVideoLoading(true);
    setVideos([]);
    try {
      const formData = new FormData();
      formData.append("prompt", videoPrompt);
      formData.append("frame", frameFile);
      formData.append("modelId", videoModel);
      const res = await fetch("/api/generate-video", { method: "POST", body: formData });
      const status = res.status;
      // Read raw body text via clone to avoid consuming the original stream twice
      const raw = await res.clone().text();
      let data: VideoApiData;
      try {
        data = JSON.parse(raw) as VideoApiData;
      } catch {
        throw { msg: 'Invalid JSON', status, details: raw };
      }
      if (!res.ok || data.error) {
        throw { msg: data.error ?? `HTTP ${status}`, status, details: raw };
      }
      setVideos(data.videos);
      if (session) {
        const inserts = data.videos.map((url) => ({ user_id: session.user.id, url, type: 'video' }));
        await supabaseBrowser.from('generated_media').insert(inserts);
        setLibraryVideos(prev => [...inserts.map(i=>i.url), ...prev]);
      }
    } catch (err: unknown) {
      console.error(err);
      const errorObj = err as { msg?: string; message?: string; status?: number; details?: unknown };
      const id = uuidv4();
      const time = new Date().toLocaleString();
      const message = errorObj.msg ?? errorObj.message ?? String(err);
      const status = errorObj.status;
      const details = errorObj.details;
      setErrorLogs(prev => [...prev, { id, flow: 'video', time, message, status, details }]);
    } finally {
      setVideoLoading(false);
    }
  };

  // Handler to use a generated image as the first frame for video creation
  const handleUseAsFrame = async (imageUrl: string) => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const fileName = imageUrl.split('/').pop() || 'frame.png';
      const file = new File([blob], fileName, { type: blob.type });
      setFrameFile(file);
    } catch (e) {
      console.error('Failed to fetch frame image:', e);
    }
  };

  // Handler to download a generated image as JPEG
  const handleDownloadImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      // Draw image into canvas to convert to JPEG
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context not available');
      ctx.drawImage(bitmap, 0, 0);
      canvas.toBlob((jpegBlob) => {
        if (!jpegBlob) throw new Error('JPEG conversion failed');
        const url = URL.createObjectURL(jpegBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'generated-image.jpg';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Failed to download image:', err);
      // Log error to the UI
      const id = uuidv4();
      const time = new Date().toLocaleString();
      const message = err instanceof Error ? err.message : String(err);
      setErrorLogs(prev => [...prev, { id, flow: 'image', time, message }]);
    }
  };

  return (
    <div className="bg-black text-gray-100 min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-gray-700 flex flex-col p-4 space-y-2">
        <button onClick={()=>setActiveTab('home')} className={`text-left px-4 py-2 rounded ${activeTab==='home'?'bg-purple-600 text-white':'text-gray-300 hover:bg-gray-800'}`}>Home</button>
        <button onClick={()=>setActiveTab('library')} className={`text-left px-4 py-2 rounded ${activeTab==='library'?'bg-purple-600 text-white':'text-gray-300 hover:bg-gray-800'}`}>My Media</button>
        <button onClick={()=>setActiveTab('grainify')} className={`text-left px-4 py-2 rounded ${activeTab==='grainify'?'bg-purple-600 text-white':'text-gray-300 hover:bg-gray-800'}`}>Grainify It</button>
      </aside>

      <div className="flex-1 p-8 space-y-12 overflow-y-auto">
        {/* Google OAuth Login/Logout */}
        <div className="flex justify-end">
          {!session ? (
            <button onClick={()=>setShowAuth(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Login / Register</button>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="text-gray-300">Signed in as {session.user.email}</span>
              <button
                onClick={() => supabaseBrowser.auth.signOut()}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >Sign out</button>
            </div>
          )}
        </div>
        {/* Logo Header */}
        {logoUrl && (
          <div className="flex justify-center mb-8">
            <img src={logoUrl} alt="Graincore Logo" className="w-96 md:w-[600px] h-auto" />
          </div>
        )}

        {/* Auth Modal */}
        {showAuth && (
          <AuthModal onClose={()=>setShowAuth(false)} />
        )}

        {activeTab==='home' && (
          <>
            <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-purple-300">Image Generator</h2>
              <form onSubmit={handleImageSubmit} className="mt-4 flex flex-col gap-4">
                <select value={imageModel} onChange={(e)=>setImageModel(e.target.value)} className="bg-gray-900 border border-gray-600 text-gray-200 rounded-full px-3 py-2">
                  {IMAGE_MODELS.map(m=> (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
                <input
                  type="text"
                  placeholder="Enter image prompt..."
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  className="bg-gray-900 border border-gray-600 rounded-full px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition"
                />
                <button
                  type="submit"
                  disabled={imageLoading}
                  className="bg-purple-900 hover:bg-purple-800 text-white font-semibold rounded-lg px-6 py-2 shadow-lg disabled:opacity-50 transition"
                >
                  {imageLoading ? <Spinner /> : "Generate Image"}
                </button>
              </form>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {images.map((src) => (
                  <div key={src} className="flex flex-col items-center">
                    <img src={src} alt="Generated" className="rounded-lg shadow-md border border-gray-700" />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseAsFrame(src)}
                        className="text-sm bg-yellow-600 text-black px-3 py-1 rounded-full hover:bg-yellow-500 transition"
                      >Use as First Frame</button>
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(src)}
                        className="text-sm bg-green-700 text-white px-3 py-1 rounded-full hover:bg-green-600 transition"
                      >Download JPEG</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {frameFile && (
              <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
                <h3 className="text-lg font-semibold text-purple-300">Selected Frame for Video</h3>
                <img
                  src={URL.createObjectURL(frameFile)}
                  alt="Selected frame"
                  className="mt-2 max-w-xs rounded-lg shadow-md border border-gray-700"
                />
              </section>
            )}

            <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-green-300">Video Generator</h2>
              <form onSubmit={handleVideoSubmit} className="mt-4 flex flex-col gap-4">
                <select value={videoModel} onChange={(e)=>setVideoModel(e.target.value)} className="bg-gray-900 border border-gray-600 text-gray-200 rounded-full px-3 py-2">
                  {VIDEO_MODELS.map(m=> (<option key={m.id} value={m.id}>{m.name}</option>))}
                </select>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFrameFile(e.target.files?.[0] || null)}
                  className="bg-gray-900 border border-gray-600 rounded-full px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                />
                <input
                  type="text"
                  placeholder="Enter video prompt..."
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  className="bg-gray-900 border border-gray-600 rounded-full px-4 py-2 text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                />
                <button
                  type="submit"
                  disabled={videoLoading}
                  className="bg-green-900 hover:bg-green-800 text-white font-semibold rounded-lg px-6 py-2 shadow-lg disabled:opacity-50 transition"
                >
                  {videoLoading ? <Spinner /> : "Generate Video"}
                </button>
              </form>
              <div className="mt-6 space-y-4">
                {videos.map((src) => (
                  <video key={src} src={src} controls className="rounded-lg shadow-md w-full border border-gray-700" />
                ))}
              </div>
            </section>

            <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-red-400">Error Logs</h2>
              <div className="mt-4 bg-gray-900 p-4 rounded max-h-64 overflow-y-auto border border-gray-700">
                {errorLogs.length === 0 ? (
                  <div className="text-gray-600">No errors logged yet.</div>
                ) : (
                  errorLogs.map(log => (
                    <div key={log.id} className="border-b pb-2 mb-2">
                      <div><strong>{log.time}</strong> [{log.flow}]</div>
                      <div className="text-red-700">{log.message}</div>
                      {log.status != null && <div>Status: {log.status}</div>}
                      {log.details !== undefined && (
                        <pre className="text-xs whitespace-pre-wrap bg-white p-2 rounded mt-1">
                          {typeof log.details === 'string'
                            ? log.details
                            : JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {session && activeTab==='library' && (
          <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
            <h2 className="text-2xl font-bold text-cyan-300">My Library</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {libraryImages.map(url=> (
                <img key={url} src={url} className="rounded-lg border border-gray-700" />
              ))}
              {libraryVideos.map(url=> (
                <video key={url} src={url} controls className="rounded-lg border border-gray-700" />
              ))}
            </div>
          </section>
        )}

        {activeTab==='grainify' && (
          <>
            {/* User video picker */}
            <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-purple-300 mb-4">My Videos</h2>
              {libraryVideos.length === 0 && <p className="text-gray-400">No videos yet.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {libraryVideos.map(url => (
                  <div key={url} className="space-y-2">
                    <video src={url} controls className="rounded-lg border border-gray-700" />
                    <button onClick={() => setSelectedVideo(url)} className="w-full bg-purple-700 hover:bg-purple-600 text-white rounded py-1 text-sm">Load in Grainifier</button>
                  </div>
                ))}
              </div>
            </section>

            {/* Grainifier Module */}
            <section className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-yellow-300 mb-4">Grainifier</h2>
              {selectedVideo ? (
                <>
                  <video src={selectedVideo} controls className="rounded-lg border border-gray-700 mb-4 w-full" />
                  <button disabled={grainLoading} onClick={async ()=>{
                    if(!session) { alert('Please sign in'); return; }
                    setGrainLoading(true);
                    try {
                      const res = await fetch('/api/grainify', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url: selectedVideo, userId: session.user.id }) });
                      const data = await res.json();
                      if(!res.ok) throw new Error(data.error||'Error');
                      setLibraryVideos(prev=>[data.url, ...prev]);
                      setSelectedVideo(data.url);
                    } catch(err: unknown){ alert((err as Error).message); }
                    finally{ setGrainLoading(false);}  
                  }} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded">
                    {grainLoading? 'Grainifying...' : 'Grainify It'}
                  </button>
                </>
              ) : (
                <p className="text-gray-400">Select a video from above to load into the Grainifier.</p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function AuthModal({ onClose }: { onClose: ()=>void }) {
  const [mode, setMode] = useState<'signin'|'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleSubmit = async () => {
    if (!email || !password) { alert('Please enter email & password'); return; }
    try {
      if (mode==='signin') {
        const { error } = await supabaseBrowser.auth.signInWithPassword({ email, password });
        if (error) { alert(error.message); return; }
        onClose();
      } else {
        const { error: signUpError } = await supabaseBrowser.auth.signUp({ email, password });
        if (signUpError) { alert(signUpError.message); return; }
        // auto sign in
        const { error: signInErr } = await supabaseBrowser.auth.signInWithPassword({ email, password });
        if (signInErr) { alert(signInErr.message); return; }
        onClose();
      }
    } catch(err) {
      alert((err as Error).message);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-full max-w-sm">
        <h3 className="text-xl font-bold mb-4 text-white">{mode==='signin'? 'Sign In' : 'Create Account'}</h3>
        <div className="flex flex-col gap-3">
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white" />
          <input value={password} type="password" onChange={e=>setPassword(e.target.value)} placeholder="Password" className="px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white" />
          <button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-500 text-white py-2 rounded">
            {mode==='signin' ? 'Sign In' : 'Sign Up'}
          </button>
          <button onClick={()=>setMode(mode==='signin'?'signup':'signin')} className="text-sm text-blue-300 underline">
            {mode==='signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          </button>
          <button onClick={onClose} className="text-sm text-gray-400 mt-2">Close</button>
        </div>
      </div>
    </div>
  );
}
