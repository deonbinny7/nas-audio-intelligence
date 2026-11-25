# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in **NAS**, please do **not** open a public GitHub issue with exploit details or sensitive information.

Instead, please report it privately through **GitHub Security Advisories** on the repository's **Security** tab.

## Secret & API Key Handling

- Never commit `backend/.env` or any file containing real API keys (`GEMINI_API_KEY`, `HF_TOKEN`).
- `backend/.env` is excluded by `.gitignore`, and the `/api/settings` endpoint returns masked key previews only (`_mask(...)`).
- Multiple comma-separated Gemini keys are stored locally in `backend/.env` for quota fallback.

## Data & Audio Privacy

- **Local Processing:** Audio preprocessing, Whisper ASR, SpeechBrain ECAPA-TDNN diarization, and librosa DSP run locally on your machine.
- **External APIs:** Transcripts (not raw audio) are sent to the Google Gemini API for translation and meeting intelligence; translated text is sent to Microsoft Edge TTS when speech synthesis is enabled.
- **Voice Enrollment:** Consent is explicitly required (`consent=True`) before saving a speaker's 192-D ECAPA-TDNN embedding in SQLite; the original enrollment audio file is deleted immediately after embedding extraction.
- **Local Storage:** Session history and uploaded/processed audio outputs are stored locally in `backend/data/nas.db` and `backend/outputs/`.
