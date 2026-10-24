"""Load cards and placement items from JSON into Supabase.

Run from backend/:
  python -m curriculum.seed --dry-run   # counts only, no DB access
  python -m curriculum.seed             # upsert (needs SUPABASE_URL / SUPABASE_KEY)
Safe to re-run: rows are upserted by key. Cards removed from JSON are not deleted.
"""
import os
import sys

from curriculum.validate import load_cards, load_placement, validate, validate_placement


def build_rows(cards: list[dict], placement: list[dict]) -> dict[str, list[dict]]:
    concepts, prereqs, questions = [], [], []
    for order, c in enumerate(cards):
        concepts.append({
            "id": c["id"], "grade": c["grade"], "category": c["category"], "title": c["title"],
            "trick": c["trick"], "explain": c["explain"], "examples": c["examples"],
            "exceptions": c["exceptions"], "i_can": c["i_can"], "passage": c.get("passage"),
            "sort_order": order,
        })
        prereqs += [{"concept_id": c["id"], "prereq_id": p} for p in c["prereqs"]]
        for idx, q in enumerate(c["questions"]):
            questions.append({
                "concept_id": c["id"], "idx": idx, "type": q["type"], "prompt": q["prompt"],
                "answer": q["answer"], "accept": q["accept"], "level": q["level"],
                "if_right": q["if_right"], "if_wrong": q["if_wrong"],
            })
    items = [{"position": i, "concept_id": p["concept"], "type": p["type"], "prompt": p["prompt"],
              "answer": p["answer"], "accept": p.get("accept", [])} for i, p in enumerate(placement)]
    return {"concepts": concepts, "concept_prereqs": prereqs, "questions": questions, "placement_items": items}


def main(dry_run: bool) -> None:
    cards, placement = load_cards(), load_placement()
    errors = validate(cards) + validate_placement(cards, placement)
    if errors:
        sys.exit("Refusing to seed, cards are invalid:\n" + "\n".join(errors))
    rows = build_rows(cards, placement)
    for table, r in rows.items():
        print(f"{table}: {len(r)} rows")
    if dry_run:
        print("Dry run: nothing written.")
        return
    from supabase import create_client
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    # parents first so foreign keys are satisfied
    for table, conflict in [("concepts", "id"), ("concept_prereqs", "concept_id,prereq_id"),
                            ("questions", "concept_id,idx"), ("placement_items", "position")]:
        for i in range(0, len(rows[table]), 200):
            db.table(table).upsert(rows[table][i:i + 200], on_conflict=conflict).execute()
        print(f"seeded {table}")


if __name__ == "__main__":
    main("--dry-run" in sys.argv)
