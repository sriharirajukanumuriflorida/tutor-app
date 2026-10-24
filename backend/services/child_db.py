"""Child profiles and progress storage. Memory store is for tests; Supabase store is real."""
import uuid
from datetime import datetime, timezone


class MemoryStore:
    def __init__(self):
        self.children, self.progress, self.log = {}, {}, []

    def create_child(self, name: str) -> dict:
        c = {"id": str(uuid.uuid4()), "name": name}
        self.children[c["id"]] = c
        return c

    def list_children(self) -> list[dict]:
        return list(self.children.values())

    def get_child(self, child_id: str):
        return self.children.get(child_id)

    def get_progress(self, child_id: str) -> dict:
        return dict(self.progress.get(child_id, {}))

    def save_progress(self, child_id: str, concept_id: str, row: dict) -> None:
        self.progress.setdefault(child_id, {})[concept_id] = dict(row)

    def log_answer(self, child_id: str, concept_id: str, idx: int, correct: bool) -> None:
        self.log.append((child_id, concept_id, idx, correct))


def _parse(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00")) if ts else None


class SupabaseStore:
    def __init__(self):
        from services.db import supabase  # needs SUPABASE_URL / SUPABASE_KEY
        self.db = supabase

    def create_child(self, name: str) -> dict:
        return self.db.table("child_profiles").insert({"name": name}).execute().data[0]

    def list_children(self) -> list[dict]:
        return self.db.table("child_profiles").select("id, name").order("created_at").execute().data

    def get_child(self, child_id: str):
        r = self.db.table("child_profiles").select("id, name").eq("id", child_id).execute().data
        return r[0] if r else None

    def get_progress(self, child_id: str) -> dict:
        rows = self.db.table("child_concept_progress").select("*").eq("child_id", child_id).execute().data
        return {r["concept_id"]: {"attempts": r["attempts"], "correct": r["correct"], "mastered": r["mastered"],
                                  "next_review_at": _parse(r["next_review_at"])} for r in rows}

    def save_progress(self, child_id: str, concept_id: str, row: dict) -> None:
        nra = row["next_review_at"]
        self.db.table("child_concept_progress").upsert({
            "child_id": child_id, "concept_id": concept_id, "attempts": row["attempts"],
            "correct": row["correct"], "mastered": row["mastered"],
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "next_review_at": nra.isoformat() if nra else None,
        }, on_conflict="child_id,concept_id").execute()

    def log_answer(self, child_id: str, concept_id: str, idx: int, correct: bool) -> None:
        self.db.table("interactions").insert({
            "session_id": child_id, "subject": "english", "correct": correct,
            "child_id": child_id, "concept_id": concept_id, "question_idx": idx,
        }).execute()
