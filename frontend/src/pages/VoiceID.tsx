import { useRef, useState } from 'react'
import { Fingerprint, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { AudioInput } from '../components/AudioInput'
import { ProcessingExplanation } from '../components/ProcessingExplanation'
import { EmbeddingScatter, SimilarityMatrix, SpeakerCards } from '../components/SpeakerViews'
import { SpeakerTimeline } from '../components/SpeakerTimeline'
import { useToast } from '../components/Toast'
import { Waveform, type WaveformHandle } from '../components/Waveform'
import { AudioActivityBars, Badge, Button, ConfirmModal, ErrorBanner, GlassPanel, Metric, Notice, PageHeader, Select, Tabs } from '../components/ui'
import { fmtTime, langName, speakerColor, speakerName } from '../components/format'
import { EXPLANATIONS } from '../data/explanations'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api, errorMessage } from '../services/api'
import type { VoiceIdResult } from '../types'

const PIPELINE_STEPS = [
  'Voice activity detection',
  'Sliding 1.5 s windows (0.75 s hop)',
  'ECAPA-TDNN 192-d embeddings',
  'Cosine similarity matrix',
  'Agglomerative clustering',
  'Smoothing & speaker turn assignment',
]

export default function VoiceID() {
  const rootRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(rootRef, [])
  const [tab, setTab] = useState<'diarize' | 'enroll' | 'verify'>('diarize')
  return (
    <div ref={rootRef}>
      <PageHeader
        eyebrow="Speaker Intelligence"
        icon={<Users className="h-5 w-5" />}
        title="VoiceID"
        subtitle="Speaker diarization with ECAPA-TDNN embeddings, cosine similarity and clustering"
      />
      <div className="gsap-reveal mb-6">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'diarize', label: 'Who spoke when', icon: <Users className="h-4 w-4" /> },
            { id: 'enroll', label: 'Speaker enrollment', icon: <UserPlus className="h-4 w-4" /> },
            { id: 'verify', label: 'Verification', icon: <ShieldCheck className="h-4 w-4" /> },
          ]}
        />
      </div>
      {tab === 'diarize' && <Diarize />}
      {tab === 'enroll' && <Enroll />}
      {tab === 'verify' && <Verify />}
    </div>
  )
}

function Diarize() {
  const toast = useToast()
  const [audio, setAudio] = useState<Blob | null>(null)
  const [n, setN] = useState('')
  const [detectLang, setDetectLang] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<VoiceIdResult | null>(null)
  const [t, setT] = useState(0)
  const wave = useRef<WaveformHandle>(null)

  const run = async () => {
    if (!audio) return
    setBusy(true)
    setError(null)
    setRes(null)
    try {
      const out = await api.speakers(audio, n ? Number(n) : undefined, detectLang)
      setRes(out)
      toast.success('Diarization complete', `${out.speaker_count} speaker(s), ${out.speakers.length} turns`)
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error('Speaker analysis failed', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gsap-reveal grid gap-6 lg:grid-cols-[360px_1fr]">
      <GlassPanel title="Recording" subtitle="Conversation with one or more speakers">
        <AudioInput onChange={setAudio} compact />
        <div className="mt-4">
          <div className="label mb-1.5">Number of speakers</div>
          <Select
            value={n}
            onChange={setN}
            options={[
              { value: '', label: 'Estimate automatically (silhouette score)' },
              ...[1, 2, 3, 4, 5, 6].map(i => ({
                value: String(i),
                label: `${i} speaker${i > 1 ? 's' : ''}`,
              })),
            ]}
          />
        </div>
        <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 text-xs text-[#b9aea4]">
          <input
            type="checkbox"
            checked={detectLang}
            onChange={e => setDetectLang(e.target.checked)}
            className="accent-[#e87528]"
          />
          Detect speaker language (Whisper ID)
        </label>
        <Button
          className="mt-4 w-full"
          disabled={!audio}
          loading={busy}
          onClick={run}
          icon={<Fingerprint className="h-4 w-4" />}
        >
          Identify speakers
        </Button>

        {busy && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#e87528]/30 bg-[#e87528]/[0.08] px-3.5 py-2.5 text-xs text-[#fce0c4]">
            <AudioActivityBars active />
            <span>Extracting ECAPA-TDNN embeddings…</span>
          </div>
        )}

        <div className="mt-6 border-t border-white/[0.07] pt-4">
          <div className="label mb-2.5 text-[10px]">Processing Methodology</div>
          <ol className="space-y-1.5 text-xs text-[#b9aea4]">
            {PIPELINE_STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-medium text-[#ff963f]">0{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      </GlassPanel>

      <div className="space-y-4">
        <ErrorBanner message={error} onClose={() => setError(null)} />

        {res ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Metric label="Speakers detected" value={res.speaker_count} />
              <Metric label="Speaker turns" value={res.speakers.length} />
              <Metric label="Backend" value={res.backend} />
              <Metric
                label="Processing time"
                value={`${res.processing_time}s`}
                hint={`${res.duration.toFixed(1)}s of audio`}
              />
            </div>

            {res.backend_note && <Notice tone="warn">{res.backend_note}</Notice>}
            {res.audio_url && <Waveform ref={wave} src={res.audio_url} regions={res.speakers} onTime={setT} />}

            <GlassPanel title="Speaker timeline" subtitle="Click any segment bar to play that turn">
              <SpeakerTimeline
                turns={res.speakers}
                duration={res.duration}
                currentTime={t}
                onSeek={(s, e) => wave.current?.playSegment(s, e)}
              />
            </GlassPanel>

            <ProcessingExplanation
              entries={[
                EXPLANATIONS.voiceid.diarization,
                EXPLANATIONS.voiceid.speaker_timeline,
                ...(n === '' ? [EXPLANATIONS.voiceid.speaker_count] as const : []),
              ]}
            />

            <SpeakerCards stats={res.speaker_stats} />

            {res.speaker_stats.some(s => s.languages?.length) && (
              <ProcessingExplanation entries={EXPLANATIONS.voiceid.language_identification} />
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <GlassPanel title="Speaker similarity matrix">
                <SimilarityMatrix data={res.similarity_matrix} />
              </GlassPanel>
              <EmbeddingScatter points={res.embedding_projection} dim={res.embedding_dim} />
            </div>

            <ProcessingExplanation
              entries={[
                EXPLANATIONS.voiceid.similarity,
                EXPLANATIONS.voiceid.clustering,
                ...(res.embedding_projection.length
                  ? [EXPLANATIONS.voiceid.embeddings, EXPLANATIONS.voiceid.pca_visualisation]
                  : []),
              ]}
            />

            <GlassPanel title="Speaker segments" subtitle={res.confidence_note}>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-[#82776f]">
                    <tr>
                      <th className="py-2">Speaker</th>
                      <th>Language</th>
                      <th>Start</th>
                      <th>End</th>
                      <th>Duration</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {res.speakers.map((s, i) => (
                      <tr
                        key={i}
                        className="cursor-pointer transition hover:bg-white/[0.035]"
                        onClick={() => wave.current?.playSegment(s.start, s.end)}
                      >
                        <td className="py-2.5">
                          <Badge color={speakerColor(s.speaker_id)}>{speakerName(s.speaker_id)}</Badge>
                        </td>
                        <td className="text-xs text-[#ffb45c]">
                          {s.language ? langName(s.language) : '—'}
                        </td>
                        <td className="font-mono text-xs text-[#f7f3ee]">
                          {fmtTime(s.start)} <span className="text-[#82776f]">({s.start.toFixed(2)})</span>
                        </td>
                        <td className="font-mono text-xs text-[#b9aea4]">{s.end.toFixed(2)}s</td>
                        <td className="font-mono text-xs text-[#b9aea4]">{s.duration.toFixed(2)}s</td>
                        <td className="font-mono text-xs text-[#82776f]">{s.confidence ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </>
        ) : (
          <GlassPanel>
            <Notice>
              VoiceID separates <b>recurring voices within a single recording</b>. Recognising a speaker across different sessions requires enrollment with their explicit consent. A short recording is not definitive proof of identity.
            </Notice>
          </GlassPanel>
        )}
      </div>
    </div>
  )
}

function Enroll() {
  const toast = useToast()
  const list = useAsync(() => api.enrolled(), [])
  const [audio, setAudio] = useState<Blob | null>(null)
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

  const run = async () => {
    if (!audio) return
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const r = (await api.enroll(audio, name, consent)) as {
        name: string
        sample_seconds: number
        note: string
      }
      setMsg(`Enrolled ${r.name} from ${r.sample_seconds}s of audio. ${r.note}`)
      toast.success('Speaker enrolled', r.name)
      setName('')
      setConsent(false)
      list.reload()
    } catch (e) {
      const m = errorMessage(e)
      setError(m)
      toast.error('Enrollment failed', m)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gsap-reveal grid gap-6 lg:grid-cols-2">
      <GlassPanel title="Enroll a voice" subtitle="Provide 10–20 seconds of natural speech">
        <AudioInput onChange={setAudio} compact />
        <input
          className="input mt-4"
          placeholder="Speaker name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <label className="mt-3.5 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-[#b9aea4]">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            className="mt-0.5 accent-[#e87528]"
          />
          This person has given explicit consent to store a 192-d voice embedding for matching in future sessions. Only the mathematical embedding is stored, not the audio recording.
        </label>
        <Button
          className="mt-4 w-full"
          disabled={!audio || !name.trim() || !consent}
          loading={busy}
          onClick={run}
          icon={<UserPlus className="h-4 w-4" />}
        >
          Enroll speaker
        </Button>
        <div className="mt-3 space-y-2">
          <ErrorBanner message={error} onClose={() => setError(null)} />
          {msg && (
            <>
              <Notice>{msg}</Notice>
              <ProcessingExplanation entries={EXPLANATIONS.voiceid.enrollment} />
            </>
          )}
        </div>
      </GlassPanel>

      <GlassPanel
        title="Enrolled speakers"
        subtitle={list.data ? `Match threshold: cosine ≥ ${list.data.match_threshold}` : undefined}
      >
        {list.data?.speakers.length ? (
          <ul className="divide-y divide-white/[0.06]">
            {list.data.speakers.map(s => (
              <li key={s.id} className="flex items-center gap-3.5 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ff963f]/35 bg-[#e87528]/18 text-sm font-semibold text-[#ff963f]">
                  {s.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-[#f7f3ee]">{s.name}</div>
                  <div className="text-xs text-[#82776f]">{s.sample_seconds}s voiceprint sample</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget({ id: s.id, name: s.name })}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[#82776f]">
            No speakers enrolled yet. Enrolled voices are matched automatically in VoiceID and MeetingLens.
          </p>
        )}
      </GlassPanel>

      <ConfirmModal
        open={!!deleteTarget}
        title="Remove enrolled speaker?"
        description={`This will permanently delete the stored voice embedding for "${deleteTarget?.name}".`}
        confirmLabel="Remove"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await api.deleteEnrolled(deleteTarget.id)
          toast.info('Speaker removed', deleteTarget.name)
          setDeleteTarget(null)
          list.reload()
        }}
      />
    </div>
  )
}

function Verify() {
  const toast = useToast()
  const [a, setA] = useState<Blob | null>(null)
  const [b, setB] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<Awaited<ReturnType<typeof api.verify>> | null>(null)

  const run = async () => {
    if (!a || !b) return
    setBusy(true)
    setError(null)
    setRes(null)
    try {
      const out = await api.verify(a, b)
      setRes(out)
      toast.success('Verification complete', `Cosine similarity: ${out.cosine_similarity.toFixed(3)}`)
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error('Verification failed', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gsap-reveal space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel title="Recording A">
          <AudioInput onChange={setA} compact />
        </GlassPanel>
        <GlassPanel title="Recording B">
          <AudioInput onChange={setB} compact />
        </GlassPanel>
      </div>
      <Button disabled={!a || !b} loading={busy} onClick={run} icon={<ShieldCheck className="h-4 w-4" />}>
        Compare voices
      </Button>
      <ErrorBanner message={error} onClose={() => setError(null)} />
      {res && (
        <GlassPanel>
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="label">Cosine similarity</div>
              <div className="mt-1 font-mono text-4xl font-semibold text-[#f7f3ee]">
                {res.cosine_similarity.toFixed(3)}
              </div>
            </div>
            <div className="min-w-[200px] flex-1">
              <div className="relative h-3 rounded-full bg-gradient-to-r from-[#f47769]/40 via-[#f0b65e]/40 to-[#43c995]/50">
                <div
                  className="absolute -top-1 h-5 w-1 rounded-full bg-[#fce0c4] shadow"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((res.cosine_similarity + 0.2) / 1.2) * 100))}%`,
                  }}
                />
                <div
                  className="absolute -top-2 h-7 w-px bg-white/50"
                  style={{ left: `${((res.threshold + 0.2) / 1.2) * 100}%` }}
                />
              </div>
              <div className="mt-2 font-mono text-xs text-[#b9aea4]">Threshold: {res.threshold}</div>
            </div>
            <Badge color={res.same_speaker_likely ? '#43c995' : '#f47769'} className="px-3 py-1 text-xs">
              {res.same_speaker_likely ? 'Likely the same speaker' : 'Likely different speakers'}
            </Badge>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-[#82776f]">{res.note}</p>
        </GlassPanel>
      )}
      {res && <ProcessingExplanation entries={EXPLANATIONS.voiceid.verification} />}
    </div>
  )
}
