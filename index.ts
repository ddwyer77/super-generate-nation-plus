console.log('Starting Python process with absolute path...');
const p = Deno.run({
  cmd: [
    'python3',
    '/var/python/video_corruptor.py', // This path should remain as is
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