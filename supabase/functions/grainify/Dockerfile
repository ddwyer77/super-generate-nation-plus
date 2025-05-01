FROM ubuntu:latest

# Install Python 3, FFmpeg, and Deno
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh
ENV PATH="/root/.deno/bin:${PATH}"

# Create directories
RUN mkdir -p /var/python

# Copy our Python script directly from the project root
COPY ../../python/video_corruptor.py /var/python/video_corruptor.py

# Make Python script executable
RUN chmod +x /var/python/video_corruptor.py

# Test Python and FFmpeg installation
RUN python3 -c "import subprocess; print('FFmpeg version check:'); print(subprocess.check_output(['ffmpeg', '-version']).decode().split('\n')[0])"

# Copy our Edge Function code
COPY . /home/deno/
WORKDIR /home/deno

# Set environment variables for proper path discovery
ENV PATH="/usr/bin:/bin:/usr/local/bin:${PATH}"

# Default command to run Deno
CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "--allow-run", "index.ts"] 