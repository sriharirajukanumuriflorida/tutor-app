import base64
import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, tts, progress

load_dotenv()

# Decode Google Cloud credentials from environment variable if present
gcloud_creds_b64 = os.getenv("GOOGLE_CLOUD_CREDENTIALS_B64")
if gcloud_creds_b64:
    creds_path = Path("/app/backend/google-cloud-key.json")
    creds_json = base64.b64decode(gcloud_creds_b64).decode("utf-8")
    creds_path.write_text(creds_json)
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(creds_path)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(progress.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
