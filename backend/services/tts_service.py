from google.cloud import texttospeech

client = texttospeech.TextToSpeechClient()

def synthesize(text: str) -> bytes:
    # Wrap in SSML to support breaks and pauses
    ssml_text = f"<speak>{text}</speak>"
    synthesis_input = texttospeech.SynthesisInput(ssml=ssml_text)
    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name="en-US-Neural2-C",  # Friendly female voice, good for kids
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
