from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.tts_service import synthesize
import io

router = APIRouter()

class TTSRequest(BaseModel):
    text: str

@router.post("/tts")
async def tts_endpoint(request: TTSRequest):
    audio_bytes = synthesize(request.text)
    return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/wav")
