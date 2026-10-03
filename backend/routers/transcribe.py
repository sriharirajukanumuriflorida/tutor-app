import struct
from fastapi import APIRouter, UploadFile, File
from google.cloud import speech

router = APIRouter()
_client = None

def _get_client():
    global _client
    if _client is None:
        _client = speech.SpeechClient()
    return _client

@router.post("/transcribe")
async def transcribe_endpoint(audio: UploadFile = File(...)):
    audio_bytes = await audio.read()
    # Read sample rate from WAV header (bytes 24-27, little-endian uint32)
    sample_rate = struct.unpack_from('<I', audio_bytes, 24)[0]

    response = _get_client().recognize(
        config=speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=sample_rate,
            language_code="en-US",
        ),
        audio=speech.RecognitionAudio(content=audio_bytes),
    )

    transcript = " ".join(
        result.alternatives[0].transcript for result in response.results
    )
    return {"transcript": transcript}
