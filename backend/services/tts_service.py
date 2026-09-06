import subprocess
import tempfile
import pathlib

VOICE = "/app/voices/en_US-lessac-medium.onnx"

def synthesize(text: str) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        out = f.name
    subprocess.run(
        ["piper", "--model", VOICE, "--output_file", out],
        input=text.encode(),
        check=True,
        capture_output=True,
    )
    return pathlib.Path(out).read_bytes()
