FROM denoland/deno:1.37.2 as builder

# Install Python 3 and FFmpeg
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /function

# Copy the Python script - using relative path
COPY ../python/video_corruptor.py ./python/video_corruptor.py

# Make Python script executable
RUN chmod +x ./python/video_corruptor.py

# Final lightweight image
FROM denoland/deno:1.37.2

# Copy installed tools from the builder
COPY --from=builder /usr/bin/python3 /usr/bin/python3
COPY --from=builder /usr/bin/ffmpeg /usr/bin/ffmpeg
COPY --from=builder /usr/lib /usr/lib
COPY --from=builder /function/python /python

# Set the Python and FFmpeg in the PATH
ENV PATH="/usr/bin:${PATH}" 