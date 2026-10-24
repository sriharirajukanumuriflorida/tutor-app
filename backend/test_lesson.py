from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from curriculum import engine
from curriculum.validate import load_cards
from routers import lesson
from services.child_db import MemoryStore

NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
CARDS = {c["id"]: c for c in load_cards()}
ORDER = [c["id"] for c in load_cards()]


def make_client():
    store = MemoryStore()
    app = FastAPI()
    app.include_router(lesson.router)
    app.dependency_overrides[lesson.get_store] = lambda: store
    return TestClient(app), store


def test_first_concept_has_no_unmet_prereqs():
    cid, review = engine.next_concept(CARDS, ORDER, {}, NOW)
    assert CARDS[cid]["prereqs"] == [] and not review and CARDS[cid]["grade"] == 1


def test_never_offers_a_card_before_its_prereqs():
    progress = {}
    for _ in range(len(ORDER)):
        cid, _ = engine.next_concept(CARDS, ORDER, progress, NOW)
        if cid is None:
            break
        assert all(progress.get(p, {}).get("mastered") for p in CARDS[cid]["prereqs"])
        progress[cid] = {"attempts": 3, "correct": 3, "mastered": True, "next_review_at": NOW + timedelta(days=30)}
    assert len([c for c in progress.values() if c["mastered"]]) == len(ORDER)  # every card is reachable


def test_mastery_needs_three_right_and_70_percent():
    r = None
    for ok in (True, True, False, True):
        r = engine.record(r, ok, NOW)
    assert r["correct"] == 3 and r["attempts"] == 4 and r["mastered"]
    assert r["next_review_at"] == NOW + engine.FIRST_REVIEW
    r = None
    for ok in (True, False, False, True, True):
        r = engine.record(r, ok, NOW)
    assert not r["mastered"]


def test_card_that_is_not_clicking_is_parked_then_resumes():
    r = None
    for _ in range(engine.GIVE_UP_ATTEMPTS):
        r = engine.record(r, False, NOW)
    assert not r["mastered"] and r["attempts"] == 0 and r["next_review_at"] > NOW
    cid, _ = engine.next_concept(CARDS, ORDER, {ORDER[0]: r}, NOW)
    assert cid != ORDER[0]
    cid, _ = engine.next_concept(CARDS, ORDER, {ORDER[0]: r}, NOW + timedelta(days=2))
    assert cid == ORDER[0]


def test_due_review_comes_first_and_a_miss_resets_it():
    done = {"attempts": 3, "correct": 3, "mastered": True, "next_review_at": NOW - timedelta(days=1)}
    cid, review = engine.next_concept(CARDS, ORDER, {ORDER[5]: done}, NOW)
    assert cid == ORDER[5] and review
    r = engine.record(done, False, NOW)
    assert not r["mastered"] and r["attempts"] == 0


def test_questions_go_easy_to_hard_and_cover_the_card():
    for card in CARDS.values():
        n = len(card["questions"])
        idxs = [engine.pick_question(card, a) for a in range(n + 2)]
        assert set(idxs) == set(range(n))
        levels = [card["questions"][i]["level"] for i in idxs[:3]]
        assert levels == sorted(levels)


def test_placement_known_includes_prereqs():
    known = engine.placement_known(CARDS, "vt-long-i-ie")
    assert "vt-long-i-ie" in known and "vt-silent-e" in known


def test_placement_flow_marks_known_and_stops_after_three_misses():
    c, store = make_client()
    kid = c.post("/children", json={"name": "Arjun"}).json()["id"]
    q = c.get(f"/children/{kid}/placement/0").json()
    assert q["total"] == 28 and q["speech"]
    r = c.post(f"/children/{kid}/placement/1", json={"answer": "x", "misses": 2}).json()
    assert r["done"] and r["next_position"] is None
    from curriculum.validate import load_placement
    item = load_placement()[0]
    r = c.post(f"/children/{kid}/placement/0", json={"answer": item["answer"]}).json()
    assert r["correct"] and not r["done"] and r["next_position"] == 1
    assert store.get_progress(kid)[item["concept"]]["mastered"]


def _answer_right(c, kid, step):
    cid, idx = step["concept"]["id"], step["question"]["index"]
    q = CARDS[cid]["questions"][idx]
    return c.post(f"/children/{kid}/answer", json={"concept_id": cid, "index": idx, "answer": q["answer"]}).json()


def test_lesson_loop_teaches_then_masters_a_card():
    c, store = make_client()
    kid = c.post("/children", json={"name": "Aryan"}).json()["id"]
    first = c.get(f"/children/{kid}/next").json()
    cid = first["concept"]["id"]
    assert first["intro"] and CARDS[cid]["trick"] in first["speech"]
    mastered_reply = None
    for _ in range(30):
        step = c.get(f"/children/{kid}/next").json()
        r = _answer_right(c, kid, step)
        if step["concept"]["id"] == cid and r["mastered"]:
            mastered_reply = r
            break
    assert mastered_reply and "Now you can" in mastered_reply["speech"]
    assert c.get(f"/children/{kid}/progress").json()["mastered"] >= 1


def test_cards_rotate_two_questions_at_a_time():
    c, _ = make_client()
    kid = c.post("/children", json={"name": "Aryan"}).json()["id"]
    seen = []
    for _ in range(6):
        step = c.get(f"/children/{kid}/next").json()
        seen.append(step["concept"]["id"])
        _answer_right(c, kid, step)
    assert seen[0] == seen[1] != seen[2] == seen[3] != seen[4] == seen[5]
    assert len(set(seen)) == 3


def test_wrong_answer_explains_and_reveal_counts_as_missed():
    c, _ = make_client()
    kid = c.post("/children", json={"name": "Aryan"}).json()["id"]
    step = c.get(f"/children/{kid}/next").json()
    cid, i = step["concept"]["id"], step["question"]["index"]
    q = CARDS[cid]["questions"][i]
    wrong = c.post(f"/children/{kid}/answer", json={"concept_id": cid, "index": i, "answer": "zzz"}).json()
    assert wrong["correct"] is False and wrong["speech"] == q["if_wrong"]
    shown = c.post(f"/children/{kid}/answer", json={"concept_id": cid, "index": i, "answer": q["answer"], "reveal": True}).json()
    assert shown["correct"] is False


def test_every_question_has_a_checkable_answer():
    from curriculum.render import check_answer
    for c in CARDS.values():
        for q in c["questions"]:
            assert q["type"] != "open" and q["answer"]
            assert check_answer(q, q["answer"]) and not check_answer(q, "zzzz qqqq")


def test_pick_one_accepts_option_text_and_digit():
    from curriculum.render import check_answer
    q = CARDS["cg-cause-effect"]["questions"][0]
    assert q["answer"] == "It rained" and q["options"] == ["It rained", "The grass got wet"]
    for typed in ("It rained", "it rained.", "1"):
        assert check_answer(q, typed)
    assert not check_answer(q, "2") and not check_answer(q, "The grass got wet")
    assert "One:" not in q["prompt"]


def test_unknown_child_and_question_are_404():
    c, _ = make_client()
    assert c.get("/children/nope/next").status_code == 404
    kid = c.post("/children", json={"name": "A"}).json()["id"]
    assert c.post(f"/children/{kid}/answer", json={"concept_id": "nope", "index": 0}).status_code == 404
    assert c.post("/children", json={"name": "  "}).status_code == 422
