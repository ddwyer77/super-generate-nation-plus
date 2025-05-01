#!/usr/bin/env python3
"""Simple test script to verify Python is working."""
import sys
import os
import subprocess

def main():
    """Test Python and subprocess functionality."""
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
        print(f"FFmpeg version: {result.stdout.split()[2]}")
    except Exception as e:
        print(f"FFmpeg test failed: {e}")

if __name__ == "__main__":
    main() 