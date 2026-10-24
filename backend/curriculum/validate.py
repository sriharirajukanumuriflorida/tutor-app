import glob
import json
import os

CARDS_DIR = os.path.join(os.path.dirname(__file__), "cards")
Q_TYPES = {"choose", "spell", "count", "say"}  # every question must have a checkable answer
REQUIRED = {"id", "grade", "category", "title", "trick", "explain", "examples", "exceptions", "prereqs", "i_can", "questions"}


# teaching order: sounds first, reading and writing skills after
FILE_ORDER = ["sound_awareness", "vowel_tricks", "consonant_tricks", "spelling_rules", "word_parts", "comprehension_grammar"]


def load_cards() -> list[dict]:
    cards = []
    paths = sorted(glob.glob(os.path.join(CARDS_DIR, "*.json")),
                   key=lambda p: (FILE_ORDER.index(os.path.basename(p)[:-5]) if os.path.basename(p)[:-5] in FILE_ORDER else 99, p))
    for path in paths:
        with open(path, encoding="utf-8") as f:
            cards.extend(json.load(f))
    return cards


def load_placement() -> list[dict]:
    with open(os.path.join(os.path.dirname(__file__), "placement.json"), encoding="utf-8") as f:
        return json.load(f)


def validate_placement(cards: list[dict], items: list[dict]) -> list[str]:
    ids = {c["id"] for c in cards}
    errors = []
    for i in items:
        if i["concept"] not in ids:
            errors.append(f"placement: unknown concept {i['concept']}")
        if i["type"] in ("choose", "count") and i["answer"] not in (i.get("options") or []):
            errors.append(f"placement: options must include the answer: {i['prompt']!r}")
        if i["type"] not in Q_TYPES or not i["answer"]:
            errors.append(f"placement: needs a checkable answer: {i['prompt']!r}")
    return errors


def validate(cards: list[dict]) -> list[str]:
    errors = []
    ids = [c["id"] for c in cards]
    for dup in {i for i in ids if ids.count(i) > 1}:
        errors.append(f"duplicate id {dup}")
    graph = {c["id"]: c["prereqs"] for c in cards}
    for c in cards:
        cid = c["id"]
        for k in REQUIRED - c.keys():
            errors.append(f"{cid}: missing {k}")
        if c.get("grade") not in (1, 2):
            errors.append(f"{cid}: bad grade")
        for p in c["prereqs"]:
            if p not in graph:
                errors.append(f"{cid}: unknown prereq {p}")
        if len(c["questions"]) < 3:
            errors.append(f"{cid}: needs at least 3 questions")
        for q in c["questions"]:
            if q["type"] not in Q_TYPES:
                errors.append(f"{cid}: bad question type {q['type']}")
            if not q.get("if_right") or not q.get("if_wrong"):
                errors.append(f"{cid}: missing feedback for {q['prompt']!r}")
            if q["type"] in ("choose", "count") and not q.get("options"):
                errors.append(f"{cid}: {q['type']} question needs options: {q['prompt']!r}")
            opts = q.get("options")
            if opts is not None and (q["answer"] not in opts or len(set(opts)) != len(opts) or not 2 <= len(opts) <= 5):
                errors.append(f"{cid}: bad options {opts} for answer {q['answer']!r}")
            if opts and q["type"] in ("spell", "say"):
                errors.append(f"{cid}: only choose/count questions take options: {q['prompt']!r}")
            if not q["answer"]:
                errors.append(f"{cid}: empty answer for {q['prompt']!r}")
    state = {}

    def visit(n):
        if state.get(n) == 1:
            errors.append(f"prereq cycle at {n}")
            return
        if state.get(n) == 2:
            return
        state[n] = 1
        for p in graph.get(n, []):
            if p in graph:
                visit(p)
        state[n] = 2

    for n in graph:
        visit(n)
    return errors


if __name__ == "__main__":
    cards = load_cards()
    errs = validate(cards) + validate_placement(cards, load_placement())
    print(f"{len(cards)} cards, {sum(len(c['questions']) for c in cards)} questions")
    print("\n".join(errs) or "OK")
    raise SystemExit(1 if errs else 0)
