import os
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from prompt import SYSTEM_PROMPT

load_dotenv(Path(__file__).parent.parent.parent / ".env", override=True)
api_key = os.getenv("LLM_API_KEY", os.getenv("ANTHROPIC_API_KEY"))
model = os.getenv("LLM_PROVIDER", "claude-haiku-4-5")

client = anthropic.Anthropic(api_key=api_key)

def chat(messages: list[dict]) -> str:
    resp = client.messages.create(
        model=model,
        max_tokens=200,
        system=SYSTEM_PROMPT,
        messages=messages,
    )
    return resp.content[0].text
