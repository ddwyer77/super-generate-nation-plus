#!/usr/bin/env python3
"""
video_corruptor.py – Graincore edition with progress lines
"""
import argparse, subprocess, sys, shutil, os
from pathlib import Path

def build_filter(g=0.6,c=2.2,gl=0.3,sc=0.2):
    base = f"format=gray,eq=contrast={c}:brightness=0,noise=alls={int(g*100)}:allf=t"
    scan = "[scan]geq=lum='if(mod(Y,4),0,255)',format=yuva444p,colorchannelmixer=aa={sc}[sl];[main][sl]overlay=format=auto[tmp]"
    glitch = f"[tmp]split=2[g1][g2];[g1]mpdecimate=hi=64:lo=32:frac=0.33,tinterlace=mode=merge,framestep=1[gx];[g2][gx]blend=all_mode='screen':opacity={gl}[outv]"
    return f"[0:v]{base},split=2[main][scan];{scan};{glitch}"

def main():
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found')
    p=argparse.ArgumentParser();
    p.add_argument('inp',type=Path);p.add_argument('out',type=Path)
    p.add_argument('--grain',type=float,default=0.6);p.add_argument('--contrast',type=float,default=2.2)
    p.add_argument('--glitch',type=float,default=0.3);p.add_argument('--scan',type=float,default=0.2)
    a=p.parse_args()
    filt=build_filter(a.grain,a.contrast,a.glitch,a.scan)
    cmd=[shutil.which('ffmpeg'),'-hide_banner','-y','-i',str(a.inp),'-filter_complex',filt,'-progress','pipe:1','-nostats','-map','[outv]','-map','0:a?','-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-b:a','128k',str(a.out)]
    proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    for line in proc.stdout:
        if 'out_time_ms' in line:
            print(line.strip())  # pass to parent for SSE
    proc.wait()
    if proc.returncode!=0:
        sys.exit('ffmpeg failed')
if __name__=='__main__':
    main() 