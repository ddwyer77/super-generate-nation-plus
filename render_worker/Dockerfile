FROM ubuntu:22.04

# Install Python, pip, FFmpeg, and other needed tools
RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Create directory for python processing scripts
RUN mkdir -p /var/python

# Copy our video processing script
COPY python/video_corruptor.py /var/python/video_corruptor.py

# Copy application code
WORKDIR /app
COPY render_worker/requirements.txt requirements.txt
RUN pip3 install --no-cache-dir -r requirements.txt
COPY render_worker .

# Expose port for Uvicorn
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"] 