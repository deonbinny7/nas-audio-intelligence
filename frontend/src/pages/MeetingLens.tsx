import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Loader2, Presentation, Sparkles } from 'lucide-react'
import { AudioInput } from '../components/AudioInput'
import { useToast } from '../components/Toast'
import { AudioActivityBars, Button, ErrorBanner, GlassPanel, Notice, PageHeader, Progress, Select, cx } from '../components/ui'
import { fmtDate, fmtDuration, langName } from '../components/format'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { useJob } from '../hooks/useJob'
import { api, errorMessage } from '../services/api'

const STAGES = [
  { id: 'preprocessing', label: 'Audio decoding & preprocessing' },
  { id: 'diarization', label: 'VoiceID speaker diarization' },
  { id: 'transcription', label: 'Whisper transcription & language ID' },
  { id: 'analysis', label: 'MeetingLens intelligence (Gemini)' },
  { id: 'saving', label: 'Report generation & persistence' },
]

export default function MeetingLens() {
  const rootRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(rootRef, [])
  const nav = useNavigate()
  const toast = useToast()
  const langs = useAsync(() => api.languages(), [])
  const meetings = useAsync(() => api.history('meeting'), [])
  const [audio, setAudio] = useState<Blob | null>(null)
  const [title, setTitle] = useState('')
  const [n, setN] = useState('')
  const [mode, setMode] = useState('multi')
  const [outLang, setOutLang] = useState('en')
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const job = useJob(jobId)

  const handledJob = useRef<string | null>(null)

  useEffect(() => {
    if (!job || handledJob.current === job.job_id + ':' + job.status) return
    if (job.status === 'done' && job.result_id) {
      handledJob.current = job.job_id + ':' + job.status
      toast.success('Meeting analysis complete')
      nav(`/meetings/${job.result_id}`)
    }
    if (job.status === 'error') {
      handledJob.current = job.job_id + ':' + job.status
      setError(job.error)
      toast.error('Meeting analysis failed', job.error ?? undefined)
      setJobId(null)
    }
  }, [job, nav, toast])

  const start = async () => {
    if (!audio) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await api.analyzeMeeting(audio, {
        title,
        num_speakers: n ? Number(n) : undefined,
        multilingual: mode === 'multi',
        output_language: outLang,
      })
      setJobId(r.job_id)
      toast.info('Meeting analysis started', 'Processing audio pipeline…')
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error('Failed to start job', msg)
    } finally {
      setSubmitting(false)
    }
  }

  const stageIdx = job ? STAGES.findIndex(s => s.id === job.stage) : -1
  const langOpts = (langs.data ?? []).map(l => ({ value: l.code, label: l.name }))

  return (
    <div ref={rootRef}>
      <PageHeader
        eyebrow="Meeting Intelligence"
        icon={<Presentation className="h-5 w-5" />}
        title="MeetingLens"
        subtitle="Audio → diarization → transcription → alignment → structured meeting intelligence"
      />

      <div className="gsap-reveal grid gap-6 lg:grid-cols-[410px_1fr]">
        <GlassPanel title="Analyse a meeting" subtitle="Upload or record a conversation to extract insights">
          <AudioInput onChange={setAudio} compact />
          <div className="mt-4 space-y-3.5">
            <div>
              <div className="label mb-1.5">Meeting title</div>
              <input
                className="input"
                placeholder="e.g. Weekly Engineering Sync (optional)"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="label mb-1.5">Speakers</div>
                <Select
                  value={n}
                  onChange={setN}
                  options={[
                    { value: '', label: 'Auto-detect' },
                    ...[2, 3, 4, 5, 6].map(i => ({ value: String(i), label: `${i} speakers` })),
                  ]}
                />
              </div>
              <div>
                <div className="label mb-1.5">Report language</div>
                <Select
                  value={outLang}
                  onChange={setOutLang}
                  options={langOpts.length ? langOpts : [{ value: 'en', label: 'English' }]}
                />
              </div>
            </div>

            <div>
              <div className="label mb-1.5">Transcription mode</div>
              <Select
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'multi', label: 'Multilingual: language detected per speaker turn' },
                  { value: 'single', label: 'Single language: one Whisper pass + overlap alignment' },
                ]}
              />
            </div>

            <Button
              className="w-full"
              disabled={!audio || !!jobId}
              loading={submitting}
              onClick={start}
              icon={<Sparkles className="h-4 w-4" />}
            >
              Analyse meeting
            </Button>
          </div>
        </GlassPanel>

        <div className="space-y-4">
          <ErrorBanner message={error} onClose={() => setError(null)} />

          {jobId && job && (
            <GlassPanel
              title={
                <span className="flex items-center gap-2.5">
                  <AudioActivityBars active />
                  Processing pipeline
                </span>
              }
              subtitle={job.message}
            >
              <Progress
                value={job.progress}
                label={STAGES[stageIdx]?.label ?? 'Queued'}
                sub={`${Math.round(job.progress * 100)}%`}
              />
              <ul className="mt-5 space-y-3">
                {STAGES.map((s, i) => (
                  <li
                    key={s.id}
                    className={cx(
                      'flex items-center gap-3 text-[13px]',
                      i < stageIdx ? 'text-[#b9aea4]' : i === stageIdx ? 'font-medium text-[#f7f3ee]' : 'text-[#82776f]',
                    )}
                  >
                    {i < stageIdx ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#43c995]" />
                    ) : i === stageIdx ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#ff963f]" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-[#5f5852]" />
                    )}
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[#82776f]">
                CPU inference runs at roughly 1–2× the recording duration using Whisper small (int8).
              </p>
            </GlassPanel>
          )}

          {!jobId && (
            <Notice>
              MeetingLens never invents content: owners and deadlines default to <b>Unknown</b> unless explicitly stated, every decision and action item includes a supporting evidence quote, and low-overlap speaker assignments are flagged as uncertain.
            </Notice>
          )}

          <GlassPanel title="Previous meetings" subtitle="Click any session to inspect its full report">
            {meetings.data?.length ? (
              <div className="divide-y divide-white/[0.06]">
                {meetings.data.map(m => (
                  <Link
                    key={m.id}
                    to={`/meetings/${m.id}`}
                    className="-mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 transition hover:bg-white/[0.04]"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e87528]/30 bg-[#e87528]/15 text-[#ff963f]">
                      <Presentation className="h-4 w-4" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#f7f3ee]">
                      {m.title}
                    </span>
                    <span className="text-xs text-[#b9aea4]">{m.speaker_count} speakers</span>
                    <span className="hidden text-xs text-[#82776f] sm:block">{langName(m.language)}</span>
                    <span className="font-mono text-xs text-[#82776f]">{fmtDuration(m.duration)}</span>
                    <span className="hidden w-28 text-right text-xs text-[#82776f] md:block">
                      {fmtDate(m.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#82776f]">No meetings analysed yet.</p>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
