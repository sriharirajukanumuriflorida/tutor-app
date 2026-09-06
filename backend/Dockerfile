FROM python:3.11-slim

RUN apt-get update && apt-get install -y wget libgomp1

# Install Piper
RUN wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_linux_x86_64.tar.gz \
    && tar xf piper_linux_x86_64.tar.gz -C /usr/local/bin --strip-components=1 \
    && rm piper_linux_x86_64.tar.gz

# Download voice model
RUN mkdir -p /app/voices && \
    wget -O /app/voices/en_US-lessac-medium.onnx \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx && \
    wget -O /app/voices/en_US-lessac-medium.onnx.json \
    https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

COPY . /app
WORKDIR /app

RUN pip install -r requirements.txt

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
