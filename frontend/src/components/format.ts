export const SPEAKER_COLORS = [
  '#E87528',
  '#FFB45C',
  '#43C995',
  '#F5C08C',
  '#FF963F',
  '#C85A1B',
  '#7FA699',
  '#B9AEA4',
  '#F47769',
  '#82776F',
]

export const CHART_COLORS = [
  '#E87528',
  '#FFB45C',
  '#C85A1B',
  '#F5C08C',
  '#82776F',
  '#5F5852',
]

export function speakerColor(id: string): string {
  const m = /(\d+)$/.exec(id)
  return m ? SPEAKER_COLORS[Number(m[1]) % SPEAKER_COLORS.length] : '#82776F'
}

export function speakerName(id: string): string {
  const m = /SPEAKER_(\d+)/.exec(id)
  return m ? `Speaker ${String(Number(m[1]) + 1).padStart(2, '0')}` : id === 'UNKNOWN' ? 'Unknown' : id
}

export function fmtTime(t: number): string {
  if (!isFinite(t)) return '00:00'
  const m = Math.floor(t / 60), s = Math.floor(t % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function fmtDuration(sec: number): string {
  if (sec < 60) return `${sec.toFixed(1)}s`
  if (sec < 3600) return `${(sec / 60).toFixed(1)}m`
  return `${(sec / 3600).toFixed(1)}h`
}

export function fmtDate(iso: string): string {
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const LANG_NAMES: Record<string, string> = {
  en: 'English', ml: 'Malayalam', hi: 'Hindi', ta: 'Tamil', kn: 'Kannada', te: 'Telugu', fr: 'French', es: 'Spanish',
  ur: 'Urdu', bn: 'Bengali', mr: 'Marathi', de: 'German', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
}
export const langName = (c?: string | null) => (c ? LANG_NAMES[c] ?? c.toUpperCase() : 'Unknown')
