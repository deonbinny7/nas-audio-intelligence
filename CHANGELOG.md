# Changelog

All notable changes to **NAS** will be documented in this file.

## [Unreleased] — Initial Repository Preparation

### Added
- **LinguaVoice:** Multilingual speech recognition (`faster-whisper`), contextual transcript translation (`Google Gemini` with multi-key fallback), neural speech synthesis (`edge-tts`), and direct text translation.
- **VoiceID:** Speaker diarization (`SpeechBrain` ECAPA-TDNN 192-D embeddings + cosine agglomerative clustering, optional `pyannote`), automatic speaker count estimation via silhouette score, per-speaker Whisper language identification, 2-D PCA embedding projection, consent-based speaker enrollment, and two-recording speaker verification.
- **MeetingLens:** Asynchronous meeting analysis pipeline with WebSocket/HTTP job progress, per-turn multilingual or single-pass overlap-aligned transcription, evidence-grounded Gemini summary/decisions/action-items extraction, and HTML/Markdown/JSON report exports.
- **Audio Lab:** Digital signal processing analysis with 16 kHz mono resampling, spectral-gating noise reduction, STFT spectrogram (`N_FFT=512`, Hamming window, 25 ms frame / 10 ms hop), 64-band Mel spectrogram, 13-coefficient MFCC heatmap, and energy-based VAD (`top_db=35`).
- **Global Explainability Layer:** Static, predefined `ProcessingExplanation` panels across every module explaining inputs, models, and processing steps without extra LLM calls.
- **Workspace UI:** Dark burnt-orange and amber glassmorphism interface with floating top navigation, GSAP staggered page transitions, interactive waveform player, SQLite session history, and `.env` settings management.
