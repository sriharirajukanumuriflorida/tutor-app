import os
import re
import requests

# ponytail: strip emojis and markdown before sending to TTS
_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
    "\U00002B00-\U00002BFF\U00002190-\U000021FF️‍]+"
)
_MARKDOWN = re.compile(r"[*_`#~]")

def _clean(text: str) -> str:
    text = _EMOJI.sub("", text)
    text = _MARKDOWN.sub("", text)
    return re.sub(r"[ \t]+", " ", text).strip()

_VOICE_ID = "BlgEcC0TfWpBak7FmvHW"

def synthesize(text: str) -> bytes:
    api_key = os.environ["ELEVENLABS_API_KEY"]
    response = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{_VOICE_ID}",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "text": _clean(text),
            "model_id": "eleven_turbo_v2_5",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        },
    )
    response.raise_for_status()
    return response.content
