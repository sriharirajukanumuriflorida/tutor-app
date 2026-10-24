"""Pure lesson logic: no DB, no network. Progress is {concept_id: row}.

A row is {"attempts": int, "correct": int, "mastered": bool, "next_review_at": datetime | None}.
"""
from datetime import datetime, timedelta

MASTER_CORRECT = 3      # right answers needed
MASTER_RATIO = 0.7      # and this share of all attempts
GIVE_UP_ATTEMPTS = 8    # park a card that is not clicking, and come back later
FIRST_REVIEW = timedelta(days=3)
LATER_REVIEW = timedelta(days=7)
PARK = timedelta(days=1)
PLACEMENT_KNOWN_REVIEW = timedelta(days=7)
PLACEMENT_MAX_MISSES = 3


def new_row() -> dict:
    return {"attempts": 0, "correct": 0, "mastered": False, "next_review_at": None}


def prereq_closure(cards: dict, cid: str) -> set[str]:
    seen, stack = set(), [cid]
    while stack:
        n = stack.pop()
        if n in seen or n not in cards:
            continue
        seen.add(n)
        stack.extend(cards[n]["prereqs"])
    return seen


def placement_known(cards: dict, concept_id: str) -> set[str]:
    # a right answer shows the child knows the concept and everything it builds on
    return prereq_closure(cards, concept_id)


MIX_WINDOW = 3  # cards in rotation
MIX_RUN = 2  # questions asked on a card before moving to the next one


def next_concept(cards: dict, order: list[str], progress: dict, now: datetime):
    """Returns (concept_id, is_review) or (None, False) when nothing is left to do."""
    def row(c):
        return progress.get(c) or new_row()

    due = [c for c in order if row(c)["mastered"] and row(c)["next_review_at"] and row(c)["next_review_at"] <= now]
    if due:
        return min(due, key=lambda c: row(c)["next_review_at"]), True
    ready = []
    for c in order:
        r = row(c)
        if r["mastered"] or (r["next_review_at"] and r["next_review_at"] > now):
            continue
        if all(row(p)["mastered"] for p in cards[c]["prereqs"]):
            ready.append(c)
    if not ready:
        return None, False
    # lowest grade first, then card order
    ready.sort(key=lambda c: (cards[c]["grade"], order.index(c)))
    # rotate through the next few cards, MIX_RUN questions each, so one card never fills a whole session
    window = ready[:MIX_WINDOW]
    return min(window, key=lambda c: (row(c)["attempts"] // MIX_RUN, window.index(c))), False


def pick_question(card: dict, attempts: int) -> int | None:
    """Easy to hard, cycling through every question on the card."""
    pool = list(range(len(card["questions"])))
    if not pool:
        return None
    pool.sort(key=lambda i: (card["questions"][i]["level"], i))
    return pool[attempts % len(pool)]


def record(row: dict | None, correct: bool, now: datetime) -> dict:
    r = dict(row or new_row())
    r["attempts"] += 1
    r["correct"] += int(correct)
    if r["mastered"]:
        if correct:
            r["next_review_at"] = now + LATER_REVIEW
        else:  # forgot it: learn it again
            r.update(new_row())
        return r
    if r["correct"] >= MASTER_CORRECT and r["correct"] / r["attempts"] >= MASTER_RATIO:
        r["mastered"] = True
        r["next_review_at"] = now + FIRST_REVIEW
    elif r["attempts"] >= GIVE_UP_ATTEMPTS:
        r["attempts"], r["correct"] = 0, 0
        r["next_review_at"] = now + PARK
    return r


def summarize(cards: dict, order: list[str], progress: dict) -> dict:
    mastered = [c for c in order if (progress.get(c) or {}).get("mastered")]
    started = [c for c in order if c not in mastered and (progress.get(c) or {}).get("attempts", 0) > 0]
    return {
        "total": len(order),
        "mastered": len(mastered),
        "in_progress": len(started),
        "mastered_ids": mastered,
        "in_progress_ids": started,
    }
