#!/usr/bin/env python3
import os
import sys
from services.llm import chat

# Test if GROQ_API_KEY is set
if not os.environ.get("GROQ_API_KEY"):
    print("ERROR: GROQ_API_KEY not set")
    sys.exit(1)

# Test a simple prompt
messages = [
    {"role": "user", "content": "hello my teaching friend"}
]

try:
    reply = chat(messages)
    print("✓ LLM response:")
    print(reply)
except Exception as e:
    print(f"✗ Error: {e}")
    sys.exit(1)
