FROM alpine:latest

# Install Python 3 and FFmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg

# Create directories
WORKDIR /app

# Create a test script
RUN echo '#!/usr/bin/env python3\nimport sys\nimport subprocess\nprint(f"Python {sys.version}")\nresult = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, text=True)\nprint(f"FFmpeg version: {result.stdout.split()[2]}")' > /app/test.py
RUN chmod +x /app/test.py

# Test Python and FFmpeg
CMD ["python3", "/app/test.py"] 