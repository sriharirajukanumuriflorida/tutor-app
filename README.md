# Voice-Based Tutor

A zero-cost, voice-interactive tutor for Grade 1 math and English, accessible on iPhone Safari.

## Setup

### 1. Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt

# Set environment variables
export GROQ_API_KEY=your_key_here
export SUPABASE_URL=your_url_here
export SUPABASE_KEY=your_key_here

# Run locally
uvicorn main:app --reload --port 8000
```

### 2. Frontend (Angular)

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200 in your browser.

## Deployment

### Backend to Render
- Connect to this repo
- Set environment variables in Render dashboard
- Deploy using Docker

### Frontend to Vercel
- `npm run build`
- Deploy the `frontend/dist/tutor-app/browser` folder to Vercel

## API Endpoints

- `POST /chat` - Send message and get tutor response
- `POST /tts` - Convert text to speech (returns WAV)
- `GET /progress/{session_id}` - Get learning progress

## Testing

Test the LLM service:
```bash
cd backend
GROQ_API_KEY=your_key python test_llm.py
```

## Architecture

- **Frontend**: Angular + Web Speech API (STT) + Web Audio API (TTS playback)
- **Backend**: FastAPI + Groq LLM (Llama-3.1-8B) + Piper TTS
- **Database**: Supabase (progress tracking only)
- **Hosting**: Render (backend) + Vercel (frontend)

Total latency: ~1-1.5 seconds per interaction.
