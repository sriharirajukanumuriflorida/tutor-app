from functools import lru_cache
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from curriculum.validate import load_cards
from curriculum.render import render_question, check_answer

router = APIRouter(prefix="/curriculum")


@lru_cache
def cards_by_id() -> dict:
    return {c["id"]: c for c in load_cards()}


def get_question(card_id: str, index: int):
    card = cards_by_id().get(card_id)
    if not card or not 0 <= index < len(card["questions"]):
        raise HTTPException(status_code=404, detail="question not found")
    return card, card["questions"][index]


@router.get("/question/{card_id}/{index}")
async def question_endpoint(card_id: str, index: int):
    _, q = get_question(card_id, index)
    return {"card_id": card_id, "index": index, "type": q["type"], **render_question(q)}


class CheckRequest(BaseModel):
    card_id: str
    index: int
    answer: str = ""
    reveal: bool = False  # child asked to see the word; counts as missed


@router.post("/check")
async def check_endpoint(req: CheckRequest):
    card, q = get_question(req.card_id, req.index)
    correct = not req.reveal and check_answer(q, req.answer)
    text = q["if_right"] if correct else q["if_wrong"]
    return {"correct": correct, "speech": text, "display": text}
