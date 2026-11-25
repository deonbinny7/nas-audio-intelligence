import { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckSquare,
  Download,
  FileText,
  Gavel,
  Languages,
  Lightbulb,
  ListChecks,
  MessageSquareQuote,
  RefreshCw,
  Users,
  Waves,
} from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AudioAnalysisPanel } from '../components/AudioAnalysisPanel'
import { ProcessingExplanation } from '../components/ProcessingExplanation'
import { EmbeddingScatter, SimilarityMatrix, SpeakerCards } from '../components/SpeakerViews'
import { SpeakerTimeline } from '../components/SpeakerTimeline'
import { useToast } from '../components/Toast'
import { Waveform, type WaveformHandle } from '../components/Waveform'
import { Badge, Button, Empty, ErrorBanner, GlassPanel, Metric, Notice, Select, Skeleton, Tabs, cx } from '../components/ui'
import { fmtDate, fmtTime, langName, speakerColor, speakerName } from '../components/format'
import { EXPLANATIONS } from '../data/explanations'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api, errorMessage } from '../services/api'

type Tab = 'overview' | 'transcript' | 'speakers' | 'summary' | 'insights' | 'actions' | 'audio'

export default function MeetingDetail() {
  const { id = '' } = useParams()
  const rootRef = useRef<HTMLDivElement>(null)
  const toast = useToast()
  const { data: m, error, loading, setData } = useAsync(() => api.meeting(id), [id])
  const langs = useAsync(() => api.languages(), [])
  const [tab, setTab] = useState<Tab>('transcript')
  const [t, setT] = useState(0)
  const [trLang, setTrLang] = useState('en')
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const wave = useRef<WaveformHandle>(null)

  useStaggerReveal(rootRef, [loading])

  const talk = useMemo(
    () =>
      (m?.speakers.speaker_stats ?? []).map(s => ({
        name: speakerName(s.speaker_id),
        id: s.speaker_id,
        seconds: s.total_duration,
        words: s.word_count ?? 0,
      })),
    [m],
  )

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (error || !m) return <ErrorBanner message={error ?? 'Meeting not found'} />

  const a = m.analysis

  const translate = async () => {
    setBusy('translate')
    setErr(null)
    try {
      const r = await api.translateMeeting(m.id, trLang)
      setData({ ...m, transcript: r.transcript, translation_language: trLang })
      toast.success('Transcript translated', langName(trLang))
    } catch (e) {
      const msg = errorMessage(e)
      setErr(msg)
      toast.error('Translation failed', msg)
    } finally {
      setBusy(null)
    }
  }

  const resummarize = async () => {
    setBusy('summary')
    setErr(null)
    try {
      const r = await api.resummarize(m.id, 'en')
      setData({ ...m, analysis: r.analysis, analysis_error: null })
      toast.success('Summary regenerated')
    } catch (e) {
      const msg = errorMessage(e)
      setErr(msg)
      toast.error('Summary failed', msg)
    } finally {
      setBusy(null)
    }
  }

  const activeLine = m.transcript.find(s => t >= s.start && t <= s.end)?.id
  const totalProcTime = Object.values(m.timings).reduce((x, y) => x + y, 0)

  return (
    <div ref={rootRef} className="space-y-6">
      <div className="gsap-reveal">
        <Link
          to="/meetinglens"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#82776f] transition hover:text-[#ff963f]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to MeetingLens
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-[#f7f3ee] sm:text-[32px]">
              {a?.meeting_title || m.title}
            </h1>
            <p className="mt-1 text-sm text-[#b9aea4]">
              {m.filename} · {fmtDate(m.created_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={api.reportUrl(m.id, 'html')} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm" icon={<FileText className="h-3.5 w-3.5" />}>
                HTML / Print PDF
              </Button>
            </a>
            <a href={api.reportUrl(m.id, 'md')}>
              <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                Markdown
              </Button>
            </a>
            <a href={api.reportUrl(m.id, 'json')}>
              <Button variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                JSON
              </Button>
            </a>
          </div>
        </div>
      </div>

      <div className="gsap-reveal grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Duration" value={fmtTime(m.duration)} />
        <Metric label="Speakers" value={m.speaker_count} hint={m.speakers.backend} />
        <Metric label="Languages" value={Object.keys(m.languages).map(langName).join(', ') || '—'} />
        <Metric label="Transcript lines" value={m.transcript.length} />
        <Metric label="ASR model" value={`Whisper ${m.asr_model}`} />
        <Metric label="Processing" value={`${totalProcTime.toFixed(1)}s`} />
      </div>

      <div className="gsap-reveal">
        <Waveform ref={wave} src={m.audio_url} regions={m.speakers.speakers} onTime={setT} />
      </div>
      <ErrorBanner message={err} onClose={() => setErr(null)} />

      <div className="gsap-reveal">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
            { id: 'transcript', label: 'Transcript', icon: <MessageSquareQuote className="h-4 w-4" />, count: m.transcript.length },
            { id: 'speakers', label: 'Speakers', icon: <Users className="h-4 w-4" />, count: m.speaker_count },
            { id: 'summary', label: 'Summary', icon: <FileText className="h-4 w-4" /> },
            { id: 'insights', label: 'Insights & Decisions', icon: <Lightbulb className="h-4 w-4" />, count: a?.decisions.length },
            { id: 'actions', label: 'Action items', icon: <ListChecks className="h-4 w-4" />, count: a?.action_items.length },
            { id: 'audio', label: 'Audio analysis', icon: <Waves className="h-4 w-4" /> },
          ]}
        />
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassPanel title="Meeting overview" className="lg:col-span-2">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <dt className="label">Title</dt>
                <dd className="mt-1 text-sm font-medium text-[#f7f3ee]">{a?.meeting_title || m.title}</dd>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <dt className="label">Alignment method</dt>
                <dd className="mt-1 font-mono text-xs text-[#b9aea4]">{m.alignment_method}</dd>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <dt className="label">Detected languages</dt>
                <dd className="mt-1 text-sm text-[#f7f3ee]">
                  {Object.keys(m.languages).map(langName).join(', ') || 'Unknown'}
                </dd>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <dt className="label">Sentiment</dt>
                <dd className="mt-1 text-sm capitalize text-[#f7f3ee]">{a?.sentiment ?? '—'}</dd>
              </div>
            </dl>
            {a?.summary && (
              <div className="mt-5 border-t border-white/[0.07] pt-4">
                <div className="label mb-2">Executive summary</div>
                <p className="text-sm leading-relaxed text-[#b9aea4]">{a.summary}</p>
              </div>
            )}
          </GlassPanel>
          <GlassPanel title="Pipeline timings" subtitle="Stage-by-stage breakdown">
            <dl className="space-y-2.5 text-xs">
              {Object.entries(m.timings).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/[0.05] pb-2 last:border-0">
                  <dt className="capitalize text-[#82776f]">{k.replace(/_/g, ' ')}</dt>
                  <dd className="font-mono text-[#f7f3ee]">{v.toFixed(2)}s</dd>
                </div>
              ))}
            </dl>
          </GlassPanel>
          <div className="lg:col-span-3">
            <ProcessingExplanation
              entries={[EXPLANATIONS.meetinglens.preprocessing, EXPLANATIONS.meetinglens.report_generation]}
            />
          </div>
        </div>
      )}

      {tab === 'transcript' && (
        <GlassPanel
          title="Speaker-labelled transcript"
          subtitle={`Click any utterance to play audio · alignment: ${m.alignment_method}`}
          action={
            <div className="flex items-center gap-2">
              <Select
                className="w-36"
                value={trLang}
                onChange={setTrLang}
                options={(langs.data ?? []).map(l => ({ value: l.code, label: l.name }))}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={busy === 'translate'}
                onClick={translate}
                icon={<Languages className="h-3.5 w-3.5" />}
              >
                Translate
              </Button>
            </div>
          }
        >
          <div className="space-y-1.5">
            {m.transcript.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => wave.current?.playSegment(s.start, s.end)}
                className={cx(
                  'flex w-full cursor-pointer gap-4 rounded-2xl px-3.5 py-3 text-left transition-all duration-150',
                  activeLine === s.id
                    ? 'border border-[#ff963f]/40 bg-[#e87528]/14 shadow-[0_0_20px_rgba(232,117,40,0.12)]'
                    : 'border border-transparent hover:bg-white/[0.04]',
                )}
              >
                <div className="w-28 shrink-0">
                  <div className="text-xs font-semibold" style={{ color: speakerColor(s.speaker_id) }}>
                    {speakerName(s.speaker_id)}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#82776f]">
                    {fmtTime(s.start)} – {fmtTime(s.end)}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {s.language && <Badge color="#b9aea4">{langName(s.language)}</Badge>}
                    {s.uncertain && (
                      <Badge color="#f0b65e">
                        <AlertCircle className="h-3 w-3" /> uncertain speaker ({Math.round(s.overlap_ratio * 100)}% overlap)
                      </Badge>
                    )}
                  </div>
                  <p className="text-[15px] leading-relaxed text-[#f7f3ee]">{s.text}</p>
                  {s.translation && (
                    <p className="mt-1.5 text-sm leading-relaxed text-[#ffb45c]">↳ {s.translation}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
          <ProcessingExplanation
            className="mt-4"
            entries={[EXPLANATIONS.meetinglens.transcription, EXPLANATIONS.meetinglens.alignment]}
          />
        </GlassPanel>
      )}

      {tab === 'speakers' && (
        <div className="space-y-4">
          <GlassPanel title="Speaker timeline" subtitle="Click any turn to play">
            <SpeakerTimeline
              turns={m.speakers.speakers}
              duration={m.duration}
              currentTime={t}
              onSeek={(s, e) => wave.current?.playSegment(s, e)}
            />
          </GlassPanel>
          <SpeakerCards stats={m.speakers.speaker_stats} />
          <div className="grid gap-4 xl:grid-cols-3">
            <GlassPanel title="Talk time" subtitle="Seconds of speech per speaker">
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={talk} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" stroke="#82776f" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#82776f" fontSize={11} width={80} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{
                        background: 'rgba(20, 17, 15, 0.96)',
                        border: '1px solid rgba(255,150,63,0.28)',
                        borderRadius: 12,
                        fontSize: 12,
                        color: '#f7f3ee',
                      }}
                    />
                    <Bar dataKey="seconds" radius={[0, 6, 6, 0]}>
                      {talk.map(d => (
                        <Cell key={d.id} fill={speakerColor(d.id)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
            <GlassPanel title="Similarity matrix">
              <SimilarityMatrix data={m.speakers.similarity_matrix} />
            </GlassPanel>
            <EmbeddingScatter points={m.speakers.embedding_projection} dim={m.speakers.embedding_dim} />
          </div>
          <ProcessingExplanation
            entries={[
              EXPLANATIONS.meetinglens.diarization,
              EXPLANATIONS.voiceid.speaker_timeline,
              EXPLANATIONS.voiceid.similarity,
              ...(m.speakers.embedding_projection.length ? [EXPLANATIONS.voiceid.pca_visualisation] : []),
            ]}
          />
        </div>
      )}

      {(tab === 'summary' || tab === 'insights' || tab === 'actions') && !a && (
        <GlassPanel>
          <Empty icon={<BarChart3 className="h-5 w-5" />} title="No meeting intelligence yet">
            {m.analysis_error ?? 'The summary was not generated.'}
            <div className="mt-4">
              <Button loading={busy === 'summary'} onClick={resummarize} icon={<RefreshCw className="h-4 w-4" />}>
                Generate summary
              </Button>
            </div>
          </Empty>
        </GlassPanel>
      )}

      {tab === 'summary' && a && (
        <div className="grid gap-4 lg:grid-cols-3">
          <GlassPanel
            title="Executive summary"
            className="lg:col-span-2"
            action={
              <Button
                variant="ghost"
                size="sm"
                loading={busy === 'summary'}
                onClick={resummarize}
                icon={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Regenerate
              </Button>
            }
          >
            <p className="text-[15px] leading-relaxed text-[#b9aea4]">{a.summary}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {a.topics.map(tp => (
                <Badge key={tp} color="#ffb45c">
                  {tp}
                </Badge>
              ))}
            </div>
          </GlassPanel>

          <div className="space-y-4">
            <GlassPanel title="Summary metrics">
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#82776f]">Sentiment</dt>
                  <dd className="capitalize text-[#f7f3ee]">{a.sentiment}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#82776f]">Decisions</dt>
                  <dd className="font-mono text-[#f7f3ee]">{a.decisions.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#82776f]">Action items</dt>
                  <dd className="font-mono text-[#f7f3ee]">{a.action_items.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#82776f]">Languages</dt>
                  <dd className="text-right text-[#f7f3ee]">{a.languages_spoken.join(', ')}</dd>
                </div>
              </dl>
            </GlassPanel>

            <GlassPanel title="Deadlines mentioned">
              {a.deadlines.length ? (
                <div className="flex flex-wrap gap-2">
                  {a.deadlines.map(d => (
                    <Badge key={d} color="#f0b65e">
                      {d}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#82776f]">None stated.</p>
              )}
            </GlassPanel>
          </div>
          <div className="lg:col-span-3">
            <ProcessingExplanation entries={EXPLANATIONS.meetinglens.summarisation} />
          </div>
        </div>
      )}

      {tab === 'insights' && a && (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassPanel
            title={
              <span className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#ffb45c]" /> Key discussion points
              </span>
            }
          >
            <ul className="space-y-3.5">
              {a.key_points.map((k, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: speakerColor(k.speaker) }}
                  />
                  <div>
                    <p className="text-sm leading-relaxed text-[#f7f3ee]">{k.point}</p>
                    <p className="mt-0.5 text-xs font-medium" style={{ color: speakerColor(k.speaker) }}>
                      {speakerName(k.speaker)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </GlassPanel>

          <div className="space-y-4">
            <GlassPanel
              title={
                <span className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-[#43c995]" /> Decisions
                </span>
              }
            >
              {a.decisions.length ? (
                <ul className="space-y-3">
                  {a.decisions.map((d, i) => (
                    <li key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                      <p className="text-sm font-medium text-[#f7f3ee]">{d.decision}</p>
                      <p className="mt-1.5 text-xs italic text-[#82776f]">“{d.evidence}”</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#82776f]">No explicit decisions in the transcript.</p>
              )}
            </GlassPanel>

            {a.missing_information.length > 0 && (
              <GlassPanel
                title={
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-[#f0b65e]" /> Unclear or missing information
                  </span>
                }
              >
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-[#b9aea4]">
                  {a.missing_information.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </GlassPanel>
            )}
          </div>
          <div className="lg:col-span-2">
            <ProcessingExplanation
              entries={[EXPLANATIONS.meetinglens.insights, EXPLANATIONS.meetinglens.decisions]}
            />
          </div>
        </div>
      )}

      {tab === 'actions' && a && (
        <GlassPanel
          title="Action items"
          subtitle="Owners and deadlines remain “Unknown” unless explicitly stated in the transcript"
        >
          {a.action_items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-[#82776f]">
                  <tr>
                    <th className="py-2.5 pr-4">Task</th>
                    <th className="pr-4">Owner</th>
                    <th className="pr-4">Deadline</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {a.action_items.map((x, i) => (
                    <tr key={i}>
                      <td className="py-3.5 pr-4">
                        <span className="flex items-start gap-2.5 text-[#f7f3ee]">
                          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#ff963f]" />
                          {x.task}
                        </span>
                      </td>
                      <td className="pr-4">
                        {x.owner === 'Unknown' ? (
                          <span className="text-[#82776f]">Unknown</span>
                        ) : (
                          <Badge color={speakerColor(x.owner)}>{speakerName(x.owner)}</Badge>
                        )}
                      </td>
                      <td className="pr-4">
                        {x.deadline === 'Unknown' ? (
                          <span className="text-[#82776f]">Unknown</span>
                        ) : (
                          <Badge color="#f0b65e">{x.deadline}</Badge>
                        )}
                      </td>
                      <td className="text-xs italic text-[#82776f]">“{x.evidence}”</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[#82776f]">No action items were stated.</p>
          )}
          <ProcessingExplanation
            className="mt-4"
            entries={EXPLANATIONS.meetinglens.action_items}
          />
        </GlassPanel>
      )}

      {tab === 'audio' &&
        (m.audio_analysis ? (
          <AudioAnalysisPanel a={m.audio_analysis} />
        ) : (
          <Notice>No audio analysis stored for this meeting.</Notice>
        ))}
    </div>
  )
}
