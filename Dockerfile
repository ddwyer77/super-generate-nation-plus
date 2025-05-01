FROM ubuntu:latest

# Install Python and FFmpeg
RUN apt-get update && apt-get install -y python3 ffmpeg

# Create a test script
RUN echo '#!/usr/bin/env python3' > /test.py
RUN echo 'import subprocess' >> /test.py
RUN echo 'print("FFmpeg version:")' >> /test.py
RUN echo 'print(subprocess.check_output(["ffmpeg", "-version"]).decode())' >> /test.py

RUN chmod +x /test.py

CMD ["python3", "/test.py"] 