from fastapi import APIRouter
from services.db import get_progress

router = APIRouter()

@router.get("/progress/{session_id}")
async def progress_endpoint(session_id: str):
    return get_progress(session_id)
