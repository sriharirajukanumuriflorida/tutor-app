import random
import re

NUMBERS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six"}
HIDDEN_DISPLAY = "Spell what Aria says."


def is_dictation(q: dict) -> bool:
    # the prompt says the target word out loud, so it must not be shown
    if q["type"] != "spell":
        return False
    return re.search(r"\b" + re.escape(q["answer"].lower()) + r"\b", q["prompt"].lower()) is not None


def _read_options(prompt: str, options: list[str]) -> str:
    # buttons are on screen, but a young child may not read them, so say them too
    if options in (["yes", "no"], ["fact", "opinion"]) or all(o.lower() in prompt.lower() for o in options):
        return ""
    if len(options) == 2:
        return f" {options[0]}, or {options[1]}?"
    return " " + ", ".join(options[:-1]) + f", or {options[-1]}?"


def _order(options: list[str]) -> list[str]:
    # keep yes/no and numbers in their natural order; shuffle the rest so the answer is not always first
    if options == ["yes", "no"] or all(o.isdigit() for o in options):
        return list(options)
    shuffled = list(options)
    random.shuffle(shuffled)
    return shuffled


def render_question(q: dict) -> dict:
    prompt = q["prompt"]
    if q.get("options"):
        return {"speech": prompt + _read_options(prompt, q["options"]), "display": prompt,
                "hide_answer": False, "options": _order(q["options"])}
    if not is_dictation(q):
        return {"speech": prompt, "display": prompt, "hide_answer": False, "options": None}
    speech = prompt
    if re.fullmatch(r"Spell the word \w+\.", prompt):
        speech += f" {q['answer']}."
    return {"speech": speech, "display": HIDDEN_DISPLAY, "hide_answer": True, "options": None}


def normalize(text: str) -> str:
    t = text.lower().replace("’", "'").strip()
    t = re.sub(r"[.!?,]+$", "", t).strip()
    t = re.sub(r"\s+", " ", t)
    return " ".join(NUMBERS.get(w, w) for w in t.split(" "))


def check_answer(q: dict, typed: str) -> bool:
    accepted = {normalize(q["answer"])} | {normalize(a) for a in q["accept"]}
    return normalize(typed) in accepted
