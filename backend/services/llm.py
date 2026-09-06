from groq import Groq
from prompt import SYSTEM_PROMPT

client = Groq()

def chat(messages: list[dict]) -> str:
    resp = client.chat.completions.create(
        model="groq/compound-mini",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        max_tokens=200,
        temperature=0.7,
    )
    return resp.choices[0].message.content
