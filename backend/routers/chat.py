from fastapi import APIRouter
from pydantic import BaseModel
from services.llm import chat as llm_chat
from services.db import log_interaction
import re

router = APIRouter()

class ChatRequest(BaseModel):
    messages: list[dict]
    session_id: str
    subject: str = None

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    reply = llm_chat(request.messages)

    if request.subject:
        correct = evaluate_answer(request.messages[-1]["content"], reply)
        log_interaction(request.session_id, request.subject, correct)

    return {"reply": reply}

def evaluate_answer(user_answer: str, model_reply: str) -> bool:
    # ponytail: simple heuristic — check if reply contains "Great try" (wrong) vs "Great" + "correct"/etc (right)
    if "great try" in model_reply.lower():
        return False
    if any(w in model_reply.lower() for w in ["correct", "exactly", "that's right", "well done"]):
        return True
    return False
