export interface ExplanationEntry {
  id: string
  title: string
  description: string
  steps?: readonly string[]
  model?: string
  note?: string
}

export const EXPLANATIONS = {
  linguavoice: {
    audio_preprocessing: {
      id: 'linguavoice.audio_preprocessing',
      title: 'Audio Preprocessing',
      description:
        'Your uploaded or recorded audio is decoded via FFmpeg into a standardised 16 kHz mono PCM waveform and peak-normalised, with optional spectral-gating noise reduction applied before recognition.',
      steps: [
        'Decode container format (WAV, MP3, M4A, WEBM, etc.) using FFmpeg',
        'Resample to 16,000 Hz single-channel (mono) audio',
        'Normalise amplitude and apply spectral-gating noise reduction if enabled',
      ],
      model: 'FFmpeg · librosa · noisereduce (spectral gating)',
    },
    speech_recognition: {
      id: 'linguavoice.speech_recognition',
      title: 'Speech Recognition & Language Detection',
      description:
        'Whisper analyses the 16 kHz speech signal, automatically identifies the spoken language (unless manually pinned), and decodes timestamped text segments.',
      steps: [
        'Run Whisper language-ID head over speech frames (when set to Auto-detect)',
        'Filter non-speech silence using energy/VAD thresholds',
        'Decode spoken utterances into timestamped text segments',
      ],
      model: 'faster-whisper (CTranslate2, int8 CPU)',
    },
    translation: {
      id: 'linguavoice.translation',
      title: 'Contextual Translation',
      description:
        'Once Whisper produces the source transcript, Gemini translates the recognised text into the selected target language while preserving conversational meaning.',
      steps: [
        'Receive recognised source transcript and detected language',
        'Translate text into the target language via Gemini structured JSON',
        'Keep original transcript and speaker-level timestamps intact',
      ],
      model: 'Google Gemini (with automatic fallback keys)',
      note: 'Translation operates strictly on the recognised transcript, not directly on raw audio.',
    },
    speech_synthesis: {
      id: 'linguavoice.speech_synthesis',
      title: 'Neural Speech Synthesis',
      description:
        'The translated text is converted into natural-sounding spoken audio using a neural voice matching the target language and selected voice gender.',
      steps: [
        'Select neural voice profile for target language and gender',
        'Synthesise translated text into MP3 audio stream',
        'Serve audio for inline playback and MP3 download',
      ],
      model: 'Microsoft Edge Neural TTS (edge-tts)',
    },
    transcription: {
      id: 'linguavoice.transcription',
      title: 'Speech-to-Text Transcription',
      description:
        'In transcription-only mode, the audio is preprocessed and decoded directly by Whisper without calling Gemini translation or speech synthesis.',
      steps: [
        'Decode and normalise audio to 16 kHz mono',
        'Detect top language candidates and probability scores',
        'Generate full transcript and timestamped ASR segments',
      ],
      model: 'faster-whisper (CTranslate2, int8 CPU)',
    },
    text_translation: {
      id: 'linguavoice.text_translation',
      title: 'Direct Text Translation',
      description:
        'Your typed text is sent directly to Gemini for translation into the target language, bypassing audio preprocessing and Whisper ASR.',
      steps: [
        'Send input text and target language to Gemini',
        'Return translated text response',
      ],
      model: 'Google Gemini',
    },
  },

  voiceid: {
    diarization: {
      id: 'voiceid.diarization',
      title: 'Speaker Diarization',
      description:
        'VoiceID partitions the recording into speech-active regions, extracts speaker embeddings over sliding windows, and groups acoustically similar segments into speaker turns.',
      steps: [
        'Energy-based Voice Activity Detection (VAD) isolates speech',
        'Extract 1.5 s sliding windows with 0.75 s hop',
        'Compute 192-D ECAPA-TDNN embeddings per window',
        'Cluster embeddings via cosine-distance agglomerative clustering',
        'Smooth short transitions and merge adjacent turns',
      ],
      model: 'SpeechBrain ECAPA-TDNN (voxceleb) · scikit-learn AgglomerativeClustering',
      note: 'Diarization separates recurring voices within a single recording; it does not identify real-world names without prior enrollment.',
    },
    speaker_count: {
      id: 'voiceid.speaker_count',
      title: 'Automatic Speaker Count Estimation',
      description:
        'When speaker count is set to Auto, the system evaluates multiple candidate cluster counts and selects the partition that maximises cosine silhouette separation.',
      model: 'Silhouette Score over Cosine Distance',
    },
    embeddings: {
      id: 'voiceid.embeddings',
      title: '192-D Voice Embeddings',
      description:
        'Each 1.5-second speech window is mapped by the ECAPA-TDNN neural network into a 192-dimensional unit-normalised vector representing vocal characteristics.',
      model: 'SpeechBrain spkrec-ecapa-voxceleb (192-D)',
    },
    similarity: {
      id: 'voiceid.similarity',
      title: 'Cosine Similarity Matrix',
      description:
        'Computes the normalised dot product between each speaker’s centroid embedding. Values closer to 1.0 indicate higher acoustic similarity between two voices.',
      model: 'sim(A, B) = (A · B) / (‖A‖ ‖B‖)',
      note: 'Acoustic similarity reflects vocal characteristics and recording conditions; it is not definitive proof of identity.',
    },
    clustering: {
      id: 'voiceid.clustering',
      title: 'Agglomerative Clustering',
      description:
        'Window embeddings are grouped hierarchically using average linkage over cosine distance until the target or silhouette-optimal number of speakers is reached.',
      model: 'Agglomerative Clustering (cosine metric)',
    },
    speaker_timeline: {
      id: 'voiceid.speaker_timeline',
      title: 'Interactive Speaker Timeline',
      description:
        'Each horizontal bar represents a merged speaking turn. Clicking any segment seeks the waveform player to that exact start and end timestamp.',
    },
    language_identification: {
      id: 'voiceid.language_identification',
      title: 'Per-Speaker Language Identification',
      description:
        'Speech turns belonging to each identified speaker are aggregated and analysed by Whisper’s language-ID head to determine each speaker’s primary spoken language.',
      steps: [
        'Collect speech segments per identified speaker ID',
        'Run Whisper language-ID head on each speaker’s audio clip',
        'Associate detected language and confidence with the speaker profile',
      ],
      model: 'faster-whisper language-ID head',
      note: 'Language changes within a speaker’s speech do not create new speaker identities.',
    },
    enrollment: {
      id: 'voiceid.enrollment',
      title: 'Consent-Based Voice Enrollment',
      description:
        'A single 192-D ECAPA-TDNN reference embedding is extracted from your enrollment sample and saved in SQLite. The original audio file is deleted immediately after extraction.',
      steps: [
        'Preprocess enrollment audio to 16 kHz mono',
        'Extract whole-clip 192-D ECAPA-TDNN embedding',
        'Store embedding vector with speaker label in SQLite and delete raw audio',
      ],
      model: 'SpeechBrain ECAPA-TDNN · SQLite',
    },
    verification: {
      id: 'voiceid.verification',
      title: 'Speaker Verification Comparison',
      description:
        'Both recordings are independently encoded into 192-D ECAPA-TDNN embeddings and compared using cosine similarity against the configured decision threshold.',
      steps: [
        'Decode and preprocess Recording A and Recording B',
        'Extract 192-D ECAPA-TDNN embedding for each recording',
        'Compute cosine similarity and compare against threshold',
      ],
      model: 'ECAPA-TDNN + Cosine Similarity',
      note: 'Voice similarity scores are probabilistic indicators and should not be treated as definitive proof of identity.',
    },
    pca_visualisation: {
      id: 'voiceid.pca_visualisation',
      title: '2-D PCA Embedding Projection',
      description:
        'Principal Component Analysis (PCA) projects the high-dimensional 192-D window embeddings down to 2 dimensions so you can visually inspect cluster separation.',
      model: 'scikit-learn PCA (192-D → 2-D)',
    },
  },

  meetinglens: {
    preprocessing: {
      id: 'meetinglens.preprocessing',
      title: 'Meeting Audio Preprocessing',
      description:
        'The uploaded meeting recording is decoded via FFmpeg to 16 kHz mono PCM, peak-normalised, and analysed for waveform, spectrogram, and voice activity metrics.',
      model: 'FFmpeg · librosa · noisereduce',
    },
    diarization: {
      id: 'meetinglens.diarization',
      title: 'Meeting Speaker Diarization',
      description:
        'VoiceID identifies who spoke when across the meeting using ECAPA-TDNN embeddings and cosine clustering, and matches against any enrolled speakers.',
      model: 'SpeechBrain ECAPA-TDNN · Agglomerative Clustering',
    },
    transcription: {
      id: 'meetinglens.transcription',
      title: 'Multilingual Meeting Transcription',
      description:
        'In multilingual mode, Whisper transcribes and detects language per speaker turn. In single-language mode, Whisper runs a single pass across the meeting.',
      model: 'faster-whisper (small, int8)',
    },
    alignment: {
      id: 'meetinglens.alignment',
      title: 'Transcript-to-Speaker Alignment',
      description:
        'ASR text segments are aligned with speaker diarization turns by temporal overlap. Segments with low overlap (<30%) are flagged as uncertain speaker assignments.',
      note: 'Timestamp alignment ensures speaker labels remain anchored to the original conversation.',
    },
    summarisation: {
      id: 'meetinglens.summarisation',
      title: 'Evidence-Grounded Summarisation',
      description:
        'Gemini synthesises the speaker-labelled transcript into an executive summary, discussion topics, and overall sentiment in your selected report language.',
      model: 'Google Gemini (structured JSON output)',
    },
    insights: {
      id: 'meetinglens.insights',
      title: 'Key Discussion Points',
      description:
        'Major talking points are extracted from the speaker-attributed transcript and linked back to the speaker who raised them.',
      model: 'Google Gemini',
    },
    decisions: {
      id: 'meetinglens.decisions',
      title: 'Decision Extraction with Evidence',
      description:
        'Explicit agreements and decisions are extracted only when supported by a verbatim quote from the transcript.',
      model: 'Google Gemini',
      note: 'Every decision includes its supporting transcript quote for verification.',
    },
    action_items: {
      id: 'meetinglens.action_items',
      title: 'Action Item Extraction',
      description:
        'Tasks, owners, and deadlines are extracted from the transcript. If an owner or deadline was not explicitly spoken, it is marked as “Unknown” rather than guessed.',
      model: 'Google Gemini',
    },
    report_generation: {
      id: 'meetinglens.report_generation',
      title: 'Report Persistence & Export',
      description:
        'The complete meeting transcript, speaker analytics, and structured intelligence are persisted to SQLite and formatted on demand as HTML (printable to PDF), Markdown, or JSON.',
      model: 'SQLite · FastAPI Report Formatter',
    },
  },

  audiolab: {
    decoding: {
      id: 'audiolab.decoding',
      title: 'Audio Decoding & Resampling',
      description:
        'Any input audio format is decoded by FFmpeg, mixed to single-channel mono, resampled to 16,000 Hz (8 kHz Nyquist bandwidth), and peak-normalised.',
      model: 'FFmpeg · soundfile · librosa',
    },
    noise_reduction: {
      id: 'audiolab.noise_reduction',
      title: 'Spectral-Gating Noise Reduction',
      description:
        'Stationary background noise is attenuated via spectral gating, estimating the noise floor across frequency bins and suppressing low-energy noise components.',
      model: 'noisereduce (spectral gating)',
    },
    spectrogram: {
      id: 'audiolab.spectrogram',
      title: 'Framing, Hamming Window & STFT Spectrogram',
      description:
        'The signal is sliced into 25 ms frames (10 ms hop), multiplied by a Hamming window to minimise spectral leakage, and transformed via a 512-point FFT to show time-frequency energy.',
      model: 'STFT · Hamming Window · N_FFT = 512',
    },
    mel_spectrogram: {
      id: 'audiolab.mel_spectrogram',
      title: 'Mel Filterbank Spectrogram',
      description:
        'Linear STFT frequencies are passed through 64 triangular Mel-scale filter banks and converted to log power, approximating how human hearing perceives pitch.',
      model: '64-band Mel Filterbank (log power)',
    },
    mfcc: {
      id: 'audiolab.mfcc',
      title: 'MFCC Feature Extraction',
      description:
        'A Discrete Cosine Transform (DCT) decorrelates the log-Mel energies into 13 Mel-Frequency Cepstral Coefficients per frame, capturing the vocal tract envelope.',
      model: '13 MFCC Coefficients · Mean-Variance Normalised',
    },
    vad: {
      id: 'audiolab.vad',
      title: 'Voice Activity Detection (VAD)',
      description:
        'Short-time energy thresholding (top_db = 35) distinguishes active speech intervals (highlighted in green) from silence or background pauses.',
      model: 'librosa.effects.split (energy VAD)',
    },
  },

  history: {
    storage: {
      id: 'history.storage',
      title: 'Local SQLite Session Persistence',
      description:
        'Every completed LinguaVoice, VoiceID, Transcription, and MeetingLens run is stored locally in SQLite alongside its metadata and output audio references.',
      model: 'SQLite · SQLAlchemy',
    },
  },

  settings: {
    configuration: {
      id: 'settings.configuration',
      title: 'Local Configuration & Key Security',
      description:
        'Settings are written directly to backend/.env on your machine. API keys and tokens are never returned to the browser in plain text—only masked previews are displayed.',
      model: 'backend/.env · Runtime Settings Reload',
    },
  },
} as const
