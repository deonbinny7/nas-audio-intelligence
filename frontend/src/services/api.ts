import axios, { AxiosError } from 'axios'
import type {
  AppSettings, AudioAnalysis, EnrolledSpeaker, Health, HistoryItem, Job, Language, Meeting, MeetingAnalysis,
  Stats, TranscribeResult, TranslateResult, TranscriptLine, VoiceIdResult,
} from '../types'

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || '').replace(/\/+$/, '')

export function apiUrl(path: string): string {
  if (!path || !API_BASE || /^(https?:|blob:|data:)/i.test(path)) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

const URL_KEYS = new Set(['audio_url', 'input_audio_url', 'original_audio_url'])
function rewriteOutputUrls(val: unknown): unknown {
  if (!API_BASE || !val || typeof val !== 'object') return val
  if (Array.isArray(val)) return val.map(rewriteOutputUrls)
  const obj = val as Record<string, unknown>
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (URL_KEYS.has(k) && typeof v === 'string' && v.startsWith('/')) {
      obj[k] = apiUrl(v)
    } else if (v && typeof v === 'object') {
      rewriteOutputUrls(v)
    }
  }
  return obj
}

export const http = axios.create({ baseURL: API_BASE, timeout: 15 * 60 * 1000 })
http.interceptors.response.use(res => {
  if (API_BASE && res.data && typeof res.data === 'object') rewriteOutputUrls(res.data)
  return res
})

/** Turn any axios/FastAPI error into a readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const d = err.response?.data as { detail?: unknown } | undefined
    if (d?.detail) return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail)
    if (err.code === 'ERR_NETWORK') return 'Cannot reach the NAS backend. Is it running on port 8000?'
    return err.message
  }
  return err instanceof Error ? err.message : String(err)
}

function form(file: Blob, fields: Record<string, string | number | boolean | null | undefined> = {}, name = 'recording.webm') {
  const fd = new FormData()
  fd.append('file', file, file instanceof File ? file.name : name)
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== '') fd.append(k, String(v))
  return fd
}

export const api = {
  health: () => http.get<Health>('/api/health').then(r => r.data),
  languages: () => http.get<{ languages: Language[] }>('/api/languages').then(r => r.data.languages),
  stats: () => http.get<Stats>('/api/stats').then(r => r.data),

  transcribe: (file: Blob, language?: string) =>
    http.post<TranscribeResult>('/api/transcribe', form(file, { language })).then(r => r.data),
  translate: (file: Blob, target_language: string, opts: { source_language?: string; gender?: string; generate_speech?: boolean } = {}) =>
    http.post<TranslateResult>('/api/translate', form(file, { target_language, ...opts })).then(r => r.data),
  translateText: (text: string, target_language: string, source_language?: string) =>
    http.post<{ translated_text: string }>('/api/translate/text', { text, target_language, source_language }).then(r => r.data),
  tts: (text: string, language: string, gender = 'female') =>
    http.post<{ audio_url: string; voice: string }>('/api/tts', { text, language, gender }).then(r => r.data),

  speakers: (file: Blob, num_speakers?: number, detect_language = true) =>
    http.post<VoiceIdResult>('/api/speakers', form(file, { num_speakers, detect_language })).then(r => r.data),
  enroll: (file: Blob, name: string, consent: boolean) =>
    http.post('/api/speakers/enroll', form(file, { name, consent })).then(r => r.data),
  enrolled: () => http.get<{ speakers: EnrolledSpeaker[]; match_threshold: number }>('/api/speakers/enrolled').then(r => r.data),
  deleteEnrolled: (id: number) => http.delete(`/api/speakers/enrolled/${id}`),
  verify: (a: Blob, b: Blob) => {
    const fd = new FormData()
    fd.append('file_a', a, a instanceof File ? a.name : 'a.webm')
    fd.append('file_b', b, b instanceof File ? b.name : 'b.webm')
    return http.post<{ cosine_similarity: number; threshold: number; same_speaker_likely: boolean; note: string }>('/api/speakers/verify', fd).then(r => r.data)
  },

  analyzeMeeting: (file: Blob, opts: { title?: string; num_speakers?: number; language?: string; multilingual?: boolean; output_language?: string; summarize?: boolean }) =>
    http.post<{ job_id: string }>('/api/meeting/analyze', form(file, opts)).then(r => r.data),
  job: (id: string) => http.get<Job>(`/api/jobs/${id}`).then(r => r.data),
  meeting: (id: string) => http.get<Meeting>(`/api/meeting/${id}`).then(r => r.data),
  translateMeeting: (id: string, target_language: string) =>
    http.post<{ transcript: TranscriptLine[] }>(`/api/meeting/${id}/translate`, { target_language }).then(r => r.data),
  resummarize: (id: string, output_language: string) =>
    http.post<{ analysis: MeetingAnalysis }>(`/api/meeting/${id}/summarize`, { output_language }).then(r => r.data),
  reportUrl: (id: string, format: 'md' | 'html' | 'json') => apiUrl(`/api/meeting/${id}/report?format=${format}`),

  analyzeAudio: (file: Blob) => http.post<AudioAnalysis>('/api/audio/analyze', form(file)).then(r => r.data),

  history: (kind?: string) => http.get<{ items: HistoryItem[] }>('/api/history', { params: { kind } }).then(r => r.data.items),
  historyItem: (id: string) => http.get<HistoryItem & { result: unknown }>(`/api/history/${id}`).then(r => r.data),
  deleteHistory: (id: string) => http.delete(`/api/history/${id}`),

  settings: () => http.get<AppSettings>('/api/settings').then(r => r.data),
  saveSettings: (s: Partial<AppSettings> & { gemini_api_key?: string; hf_token?: string }) =>
    http.post<AppSettings>('/api/settings', s).then(r => r.data),
  unload: () => http.post('/api/system/unload'),
}
