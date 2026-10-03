import re
from xml.sax.saxutils import escape
from google.cloud import texttospeech

_client = None

# ponytail: strip what TTS reads aloud — emojis, markdown formatting chars.
# XML-escape the rest so &, <, > don't break the <speak> wrapper.
_EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
    "\U00002B00-\U00002BFF\U00002190-\U000021FF️‍]+"
)
_MARKDOWN = re.compile(r"[*_`#~]")

def _clean(text: str) -> str:
    text = _EMOJI.sub("", text)
    text = _MARKDOWN.sub("", text)
    text = re.sub(r"[ \t]+", " ", text).strip()
    return escape(text)  # escapes & < > for SSML

def _get_client():
    global _client
    if _client is None:
        _client = texttospeech.TextToSpeechClient()
    return _client

def synthesize(text: str) -> bytes:
    client = _get_client()
    # Wrap in SSML to support breaks and pauses
    ssml_text = f"<speak>{_clean(text)}</speak>"
    synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Neural2-C",
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=22050,
    )
    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    return response.audio_content
