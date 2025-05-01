#!/usr/bin/env python3
"""Test Python and FFmpeg."""
import sys
import os
import subprocess

print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current directory: {os.getcwd()}")
print(f"Directory listing: {os.listdir('.')}")
    
try:
    # Test FFmpeg
    result = subprocess.run(['ffmpeg', '-version'], 
                           stdout=subprocess.PIPE, 
                           stderr=subprocess.PIPE,
                           text=True)
    print(f"FFmpeg version output: {result.stdout.split('\n')[0]}")
    print(f"FFmpeg path: {subprocess.run(['which', 'ffmpeg'], stdout=subprocess.PIPE, text=True).stdout.strip()}")
    
    # Print the entire FFmpeg output
    print("\nFull FFmpeg output:")
    print(result.stdout)
except Exception as e:
    print(f"FFmpeg test failed: {e}") 