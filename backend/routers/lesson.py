from datetime import datetime, timezone
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from curriculum import engine
from curriculum.render import check_answer, render_question
from curriculum.validate import load_cards, load_placement

router = APIRouter()


@lru_cache
def _cards() -> tuple[dict, list[str]]:
    cards = load_cards()
    return {c["id"]: c for c in cards}, [c["id"] for c in cards]


@lru_cache
def _placement() -> list[dict]:
    return load_placement()


@lru_cache
def _store():
    from services.child_db import SupabaseStore
    return SupabaseStore()


def get_store():
    return _store()


def now() -> datetime:
    return datetime.now(timezone.utc)


def child_or_404(store, child_id: str) -> dict:
    child = store.get_child(child_id)
    if not child:
        raise HTTPException(status_code=404, detail="child not found")
    return child


class NewChild(BaseModel):
    name: str


@router.post("/children")
async def create_child(body: NewChild, store=Depends(get_store)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name is required")
    return store.create_child(name)


@router.get("/children")
async def list_children(store=Depends(get_store)):
    return store.list_children()


@router.get("/children/{child_id}/progress")
async def child_progress(child_id: str, store=Depends(get_store)):
    child_or_404(store, child_id)
    cards, order = _cards()
    return {"child": child_id, **engine.summarize(cards, order, store.get_progress(child_id))}


# ---- placement quiz: easy to hard, stops after 3 misses in a row ----

def _placement_item(position: int) -> dict:
    items = _placement()
    if not 0 <= position < len(items):
        raise HTTPException(status_code=404, detail="placement item not found")
    return items[position]


@router.get("/children/{child_id}/placement/{position}")
async def placement_question(child_id: str, position: int, store=Depends(get_store)):
    child_or_404(store, child_id)
    item = _placement_item(position)
    return {"position": position, "total": len(_placement()), "type": item["type"], **render_question(item)}


class PlacementAnswer(BaseModel):
    answer: str = ""
    misses: int = 0  # misses in a row so far, kept by the app


@router.post("/children/{child_id}/placement/{position}")
async def placement_answer(child_id: str, position: int, body: PlacementAnswer, store=Depends(get_store)):
    child_or_404(store, child_id)
    item = _placement_item(position)
    cards, _ = _cards()
    correct = check_answer(item, body.answer)
    misses = 0 if correct else body.misses + 1
    if correct:
        progress = store.get_progress(child_id)
        for cid in engine.placement_known(cards, item["concept"]):
            if not (progress.get(cid) or {}).get("mastered"):
                store.save_progress(child_id, cid, {
                    "attempts": 0, "correct": 0, "mastered": True,
                    "next_review_at": now() + engine.PLACEMENT_KNOWN_REVIEW})
    done = misses >= engine.PLACEMENT_MAX_MISSES or position + 1 >= len(_placement())
    # no teaching during placement, just a kind word
    speech = "Great job!" if correct else "That is okay. Let us try the next one."
    if done:
        speech += " All done. Thank you! Now we will learn something fun."
    return {"correct": correct, "speech": speech, "display": speech, "misses": misses,
            "done": done, "next_position": None if done else position + 1}


# ---- lessons ----

@router.get("/children/{child_id}/next")
async def next_step(child_id: str, store=Depends(get_store)):
    child_or_404(store, child_id)
    cards, order = _cards()
    progress = store.get_progress(child_id)
    cid, is_review = engine.next_concept(cards, order, progress, now())
    if cid is None:
        return {"done": True, "speech": "You have learned everything for now. Great job! Come back soon."}
    card = cards[cid]
    row = progress.get(cid) or engine.new_row()
    idx = engine.pick_question(card, row["attempts"])
    if idx is None:
        raise HTTPException(status_code=500, detail=f"{cid} has no scored question")
    q = render_question(card["questions"][idx])
    teach = row["attempts"] == 0 and not is_review
    intro = f"{card['trick']} {card['explain']}" if teach else None
    speech = f"{intro} Now you try. {q['speech']}" if intro else q["speech"]
    return {
        "done": False, "is_review": is_review,
        "concept": {"id": cid, "title": card["title"], "grade": card["grade"], "i_can": card["i_can"]},
        "intro": intro,
        "question": {"index": idx, "type": card["questions"][idx]["type"], **q},
        "speech": speech,
    }


class Answer(BaseModel):
    concept_id: str
    index: int
    answer: str = ""
    reveal: bool = False  # "show me the word": counts as missed


@router.post("/children/{child_id}/answer")
async def answer(child_id: str, body: Answer, store=Depends(get_store)):
    child_or_404(store, child_id)
    cards, _ = _cards()
    card = cards.get(body.concept_id)
    if not card or not 0 <= body.index < len(card["questions"]):
        raise HTTPException(status_code=404, detail="question not found")
    q = card["questions"][body.index]
    correct = not body.reveal and check_answer(q, body.answer)
    before = store.get_progress(child_id).get(body.concept_id)
    row = engine.record(before, correct, now())
    store.save_progress(child_id, body.concept_id, row)
    store.log_answer(child_id, body.concept_id, body.index, correct)
    text = q["if_right"] if correct else q["if_wrong"]
    just_mastered = row["mastered"] and not (before or {}).get("mastered")
    if just_mastered:
        text += f" You did it! {card['i_can'].replace('I can', 'Now you can', 1)}"
    return {"correct": correct, "speech": text, "display": text, "mastered": just_mastered}
