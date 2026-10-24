NUM = {"1": "one", "2": "two", "3": "three", "4": "four", "5": "five"}


def feedback(card: dict, q: dict) -> tuple[str, str]:
    t, a, tr = q["type"], q["answer"], card["trick"]
    if t == "spell":
        letters = ", ".join(a)
        return (f"Yes! You spelled {a} right! It is {letters}. Remember this trick: {tr}",
                f"Good try! {a} is spelled {letters}. Remember this trick: {tr} Let us try one more.")
    if t in ("choose", "count"):
        s = q.get("answer_text") or NUM.get(a, a)
        return (f"Yes, {s}! You are right. Remember this trick: {tr}",
                f"Nice try! The answer is {s}. Remember this trick: {tr} Let us try again.")
    if t == "say":
        return (f"You got it! {a}! Great job. Remember this trick: {tr}",
                f"Good try! The answer is {a}. Remember this trick: {tr} Let us try another one.")
    return (f"I love your thinking! Thank you for telling me. Remember this trick: {tr}",
            f"Thank you for telling me. Remember this trick: {tr} Let us look at it together.")
