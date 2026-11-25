# Troubleshooting Guide

## 1. FFmpeg Missing (`FFmpeg missing` in Settings / Health)
- **Cause:** `shutil.which("ffmpeg")` returned `None`.
- **Fix (Windows):**
  ```powershell
  winget install --id Gyan.FFmpeg -e
  ```
  Restart your terminal and backend server so `PATH` reloads, then verify with `ffmpeg -version`.

## 2. Gemini Key Errors (`GEMINI_API_KEY is not set` or Quota Exceeded)
- **Fix:** Open **Settings** in the UI or edit `backend/.env` and set `GEMINI_API_KEY`.
- You can provide multiple comma-separated keys (`key1,key2,key3`); `gemini_client.py` automatically falls back across keys and fallback models (`gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-2.5-flash-lite`) on quota/rate-limit errors.

## 3. Slow First Run in LinguaVoice, VoiceID, or MeetingLens
- **Cause:** The first time Whisper `small` (~480 MB) or SpeechBrain `spkrec-ecapa-voxceleb` (~80 MB) is used, it downloads from Hugging Face Hub into `backend/pretrained_models/`.
- **Fix:** Wait for the initial download to finish; subsequent runs load directly from disk.

## 4. Rolldown / Vite Native Binding Error on Windows
- **Symptom:** `Error: Cannot find native binding` when running `npm run dev`.
- **Fix:**
  ```powershell
  cd frontend
  npm i @rolldown/binding-win32-x64-msvc -D
  ```

## 5. Backend Offline (`Cannot reach the NAS backend. Is it running on port 8000?`)
- **Fix:** Ensure `uvicorn app.main:app --port 8000` is running inside `backend/` with the virtual environment activated.

## 6. High RAM Usage on 8 GB Laptops
- **Fix:** Use **Settings → Free memory** (`POST /api/system/unload`) to release Whisper and ECAPA-TDNN weights from RAM between sessions, or switch `WHISPER_MODEL` from `small` to `base` or `tiny`.
