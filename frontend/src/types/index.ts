
export interface Language { code: string; name: string; native: string; tts_voices: Record<string, string> }

export interface AsrSegment {
  id: number; start: number; end: number; text: string
  avg_logprob?: number; no_speech_prob?: number
  words?: { word: string; start: number; end: number; probability: number }[]
}

export interface TranscribeResult {
  session_id: string; language: string; language_probability: number
  language_candidates: { code: string; probability: number }[]
  duration: number; text: string; segments: AsrSegment[]; model: string
  processing_time: number; real_time_factor: number | null; input_audio_url: string
}

export interface TranslateResult {
  session_id: string; source_language: string; source_language_probability: number | null
  target_language: string; original_text: string; translated_text: string
  audio_url: string | null; input_audio_url: string | null; voice: string | null
  segments: AsrSegment[]; timings: Record<string, number>; tts_error: string | null
}

export interface SpeakerTurn { speaker_id: string; start: number; end: number; duration: number; confidence: number | null; language?: string }

export interface SpeakerStat {
  speaker_id: string; total_duration: number; percentage: number; segment_count: number
  first_seen: number; last_seen: number; languages?: string[]; language_probability?: number; word_count?: number
  enrolled_match: { name: string; enrolled_id: number; similarity: number; matched: boolean } | null
}

export interface VoiceIdResult {
  session_id?: string; audio_url?: string
  speakers: SpeakerTurn[]; speaker_count: number; speaker_stats: SpeakerStat[]
  similarity_matrix: { speaker_ids: string[]; matrix: (number | null)[][] }
  embedding_projection: { x: number; y: number; speaker_id: string }[]
  embedding_dim: number; backend: string; backend_note: string | null
  meta: Record<string, unknown>; duration: number; processing_time: number; confidence_note: string
}

export interface TranscriptLine {
  id: number; start: number; end: number; text: string; speaker_id: string
  language?: string; language_probability?: number; overlap_ratio: number; uncertain: boolean
  translation?: string
}

export interface MeetingAnalysis {
  meeting_title: string; summary: string
  key_points: { point: string; speaker: string }[]
  decisions: { decision: string; evidence: string }[]
  action_items: { task: string; owner: string; deadline: string; evidence: string }[]
  deadlines: string[]; topics: string[]; languages_spoken: string[]; sentiment: string
  missing_information: string[]; processing_time: number
}

export interface Heatmap { rows: number; cols: number; min: number; max: number; unit?: string; data: number[][] }

export interface AudioAnalysis {
  duration: number; sample_rate: number; original_sample_rate: number | null; channels: number | null
  format: string | null; frame_length_ms: number; hop_length_ms: number; n_fft: number; window: string
  num_frames: number; rms_mean: number; zcr_mean: number; spectral_centroid_mean_hz: number
  estimated_noise_removed_db: number; speech_ratio: number; vad_segments: { start: number; end: number }[]
  waveform_original: [number, number][]; waveform_denoised: [number, number][]
  spectrogram: Heatmap; mel_spectrogram: Heatmap; mfcc: Heatmap
  audio_url?: string; original_audio_url?: string
}

export interface Meeting {
  id: string; title: string; filename: string; audio_url: string; duration: number
  language: string | null; speaker_count: number; created_at: string
  languages: Record<string, number>; transcript: TranscriptLine[]; full_text: string
  speakers: VoiceIdResult; analysis: MeetingAnalysis | null; analysis_error: string | null
  audio_analysis: AudioAnalysis; alignment_method: string; asr_model: string
  timings: Record<string, number>; translation_language?: string
}

export interface Job {
  job_id: string; kind: string; status: 'queued' | 'running' | 'done' | 'error'
  stage: string; progress: number; message: string; result_id: string | null; error: string | null
}

export interface HistoryItem {
  id: string; kind: string; title: string; filename: string; duration: number
  language: string | null; speaker_count: number; audio_url: string | null; created_at: string
}

export interface Stats {
  total_sessions: number; audio_seconds: number; speakers_identified: number; languages_supported: number
  by_kind: Record<string, number>; languages: Record<string, number>; enrolled_speakers: number
  activity: { date: string; sessions: number; minutes: number }[]
  recent: Omit<HistoryItem, 'filename' | 'audio_url'>[]
}

export interface Health {
  status: string; ffmpeg: boolean; gemini_key_set: boolean; hf_token_set: boolean
  whisper: { model: string; compute_type: string; loaded: boolean }
  diarization: {
    configured: string; active: string; pyannote_installed: boolean; hf_token_set: boolean
    encoder_loaded: boolean; last_error: string | null
  }
}

export interface AppSettings {
  gemini_api_key: string; gemini_key_set: boolean; hf_token: string; hf_token_set: boolean
  gemini_model: string; whisper_model: string; whisper_compute_type: string
  diarization_backend: string; noise_reduction: boolean
}

export interface EnrolledSpeaker { id: number; name: string; sample_seconds: number; created_at: string }
