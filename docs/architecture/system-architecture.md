# System Architecture

NAS is built as a decoupled client-server audio intelligence workspace combining a **React + TypeScript** frontend with a **FastAPI + SQLite** backend.

## High-Level Architecture

```mermaid
flowchart LR
    U[User / Browser] -->|Upload / Mic Audio| FE[React + TypeScript UI<br/>Vite :5173]
    FE -->|REST /api/* & WS /ws/jobs/*| API[FastAPI Backend<br/>Uvicorn :8000]
    API -->|Decode & DSP| DSP[FFmpeg + librosa + noisereduce]
    API -->|ASR & Language ID| ASR[faster-whisper int8 CPU]
    API -->|Speaker Embeddings| VID[SpeechBrain ECAPA-TDNN / pyannote]
    API -->|Translation & Insights| LLM[Google Gemini API]
    API -->|Neural TTS| TTS[Microsoft Edge TTS]
    API -->|Persist Sessions & Embeddings| DB[(SQLite: nas.db)]
    API -->|Serve Processed Audio| OUT[/outputs Static Files]
    OUT --> FE
    DB --> FE
```

## Communication Layer

- **Development Proxy (`frontend/vite.config.ts`):** Vite proxies `/api`, `/outputs`, and `/ws` to `http://127.0.0.1:8000`.
- **Synchronous Endpoints:** LinguaVoice (`/api/transcribe`, `/api/translate`, `/api/translate/text`, `/api/tts`), VoiceID (`/api/speakers`, `/api/speakers/enroll`, `/api/speakers/verify`), and Audio Lab (`/api/audio/analyze`) run CPU-bound inference in FastAPI's threadpool (`run_in_threadpool`).
- **Asynchronous Meeting Pipeline:** `/api/meeting/analyze` enqueues a background job (`services/jobs.py`) and returns a `job_id`. The frontend subscribes over WebSocket (`/ws/jobs/{id}`) with HTTP polling fallback (`/api/jobs/{id}`).

## Model Storage & Memory Management

- **Whisper Weights:** Downloaded on first use into `backend/pretrained_models/whisper/`.
- **SpeechBrain ECAPA-TDNN:** Downloaded on first use into `backend/pretrained_models/spkrec-ecapa-voxceleb/` using `LocalStrategy.COPY` on Windows to avoid symlink privilege errors.
- **Memory Unloading:** `POST /api/system/unload` releases cached Whisper and ECAPA-TDNN models from RAM and triggers garbage collection.
