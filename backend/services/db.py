import os
from supabase import create_client, Client

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

def log_interaction(session_id: str, subject: str, correct: bool):
    supabase.table("interactions").insert({
        "session_id": session_id,
        "subject": subject,
        "correct": correct,
    }).execute()

def get_progress(session_id: str):
    result = supabase.table("interactions").select("subject, correct").eq("session_id", session_id).execute()
    math_correct = sum(1 for r in result.data if r["subject"] == "math" and r["correct"])
    math_total = sum(1 for r in result.data if r["subject"] == "math")
    eng_correct = sum(1 for r in result.data if r["subject"] == "english" and r["correct"])
    eng_total = sum(1 for r in result.data if r["subject"] == "english")
    return {
        "math": {"correct": math_correct, "total": math_total},
        "english": {"correct": eng_correct, "total": eng_total},
    }
