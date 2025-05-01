FROM ubuntu:latest

# Install Python 3 and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Simple test script
RUN echo "#!/usr/bin/env python3" > /test.py \
    && echo "import subprocess" >> /test.py \
    && echo "print('FFmpeg version:')" >> /test.py \
    && echo "print(subprocess.check_output(['ffmpeg', '-version']).decode())" >> /test.py
    
RUN chmod +x /test.py

CMD ["python3", "/test.py"] 