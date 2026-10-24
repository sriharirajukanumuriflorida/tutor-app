# Voice-Based Tutor

A voice-interactive tutor named Aria for Grade 1-2 literacy (phonics, spelling, grammar, comprehension) and free chat for math, accessible on iPhone Safari. Aria greets the child, asks the name, and teaches from a bank of concept cards. See `implementation.md` for the design, status and known gaps.

## Setup

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt

# Python 3.12 works with the pinned requirements (3.14 does not)
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Put these in backend/.env (git-ignored). Names are case-sensitive.
#   ANTHROPIC_API_KEY=...      free chat (or LLM_API_KEY; LLM_PROVIDER overrides the model name)
#   ELEVENLABS_API_KEY=...     Aria's voice (/tts)
#   SUPABASE_URL=...           children and progress
#   SUPABASE_KEY=...           use the service_role key; keep it on the server only
#   GOOGLE_CLOUD_CREDENTIALS_B64=...   speech-to-text fallback (/transcribe), base64 of the key file

# Run locally
uvicorn main:app --reload --port 8000
```

Database: run `backend/db/migrations/001_curriculum.sql` once in the Supabase SQL editor, then load the cards:
```bash
cd backend && python -m curriculum.seed
```

### 2. Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200 in your browser. `npm start` proxies `/api` to the backend on port 8000 (`frontend/proxy.conf.json`).

## Deployment

### Backend to Render
- Connect to this repo
- Set environment variables in Render dashboard
- Deploy using Docker

### Frontend to Vercel
- `npm run build`
- Deploy the `frontend/dist/tutor-app/browser` folder to Vercel

## API Endpoints

- `POST /chat` - Free chat with Aria (uses `prompt.py`)
- `POST /tts` - Convert text to speech (ElevenLabs, returns audio)
- `POST /transcribe` - Speech to text (Google Cloud)
- `GET /progress/{session_id}` - Progress for the old chat sessions
- `POST /children`, `GET /children` - Create and list child profiles
- `GET /children/{id}/placement/{n}`, `POST /children/{id}/placement/{n}` - Placement quiz
- `GET /children/{id}/next`, `POST /children/{id}/answer` - Lesson loop
- `GET /children/{id}/progress` - Cards learned
- `GET /curriculum/question/{card_id}/{index}`, `POST /curriculum/check` - Read or check one question

## Testing

Backend tests (cards, scoring and lesson logic; no network or keys needed):
```bash
cd backend
pip install pytest httpx
python -m pytest -q test_cards.py test_lesson.py
python -m curriculum.validate
```

Test the LLM service (needs `ANTHROPIC_API_KEY` or `LLM_API_KEY`):
```bash
cd backend
python test_llm.py
```

## Architecture

- **Frontend**: Angular + Web Speech API (STT, with a recording fallback on iOS) + Web Audio API (TTS playback)
- **Backend**: FastAPI + Anthropic Claude (free chat) + ElevenLabs TTS. Lessons are scored in Python from JSON cards in `backend/curriculum/`; the LLM is not used for lessons
- **Database**: Supabase (children, lesson progress, curriculum cards)
- **Hosting**: Render (backend) + Vercel (frontend)
