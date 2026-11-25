import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, AudioLines, Clock, Languages, Presentation, Users, Waves } from 'lucide-react'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api } from '../services/api'
import { Badge, Empty, ErrorBanner, GlassPanel, Skeleton } from '../components/ui'
import { CHART_COLORS, fmtDate, fmtDuration, langName } from '../components/format'

const MODULES = [
  {
    to: '/linguavoice',
    name: 'LinguaVoice',
    desc: 'Speech recognition, multilingual translation and neural speech synthesis.',
    icon: Languages,
    tech: ['Whisper', 'Gemini', 'Edge TTS'],
  },
  {
    to: '/voiceid',
    name: 'VoiceID',
    desc: 'Speaker diarization, voice embeddings and verification.',
    icon: Users,
    tech: ['ECAPA-TDNN', 'Cosine Similarity', 'Clustering'],
  },
  {
    to: '/meetinglens',
    name: 'MeetingLens',
    desc: 'Speaker-aware transcription, meeting summaries and action items.',
    icon: Presentation,
    tech: ['ASR', 'Diarization', 'Alignment', 'LLM'],
  },
]

const KIND_LABEL: Record<string, string> = {
  meeting: 'MeetingLens',
  speakers: 'VoiceID',
  translate: 'LinguaVoice',
  transcribe: 'Transcription',
}

export default function Dashboard() {
  const rootRef = useRef<HTMLDivElement>(null)
  const stats = useAsync(() => api.stats(), [])
  const health = useAsync(() => api.health(), [])
  const s = stats.data
  const langData = s ? Object.entries(s.languages).map(([k, v]) => ({ name: langName(k), value: v })) : []

  useStaggerReveal(rootRef, [])

  return (
    <div ref={rootRef} className="space-y-6">
      {/* Hero Section */}
      <section className="glass-panel-elevated gsap-reveal relative overflow-hidden p-6 sm:p-8 md:p-10">
        <div className="pointer-events-none absolute -top-28 -right-20 h-80 w-80 rounded-full bg-[#e87528]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-[#c85a1b]/10 blur-3xl" />

        <div className="relative flex flex-col items-center text-center">
          <div className="max-w-2xl">
            <div className="mb-5 flex justify-center">
              <div className="glass-logo-frame inline-flex items-center rounded-2xl px-4 py-2.5">
                <img
                  src="/nas-logo.png"
                  alt="NAS"
                  className="h-7 w-auto object-contain sm:h-8"
                />
              </div>
            </div>
            <h1 className="text-[32px] font-semibold tracking-tight text-[#f7f3ee] sm:text-[42px] leading-[1.12]">
              Intelligent speech.
              <br />
              <span className="gradient-text">Connected conversations.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed text-[#b9aea4] sm:text-[15px]">
              Transform conversations into structured intelligence through speech recognition, multilingual translation and advanced speaker intelligence.
            </p>
          </div>
        </div>
      </section>

      <ErrorBanner message={stats.error} />

      {/* Key Metrics */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Audio sessions', value: s?.total_sessions ?? '—', icon: AudioLines },
          { label: 'Speakers identified', value: s?.speakers_identified ?? '—', icon: Users },
          { label: 'Languages supported', value: s?.languages_supported ?? '—', icon: Languages },
          { label: 'Total audio processed', value: s ? fmtDuration(s.audio_seconds) : '—', icon: Clock },
        ].map(k => (
          <div key={k.label} className="glass-panel glass-hover gsap-reveal p-5">
            <div className="flex items-center justify-between">
              <span className="label">{k.label}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#e87528]/25 bg-[#e87528]/12 text-[#ff963f]">
                <k.icon className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f3ee]">
              {stats.loading ? <Skeleton className="h-9 w-20" /> : k.value}
            </div>
          </div>
        ))}
      </section>

      {/* Module Overview */}
      <section className="grid gap-4 lg:grid-cols-3">
        {MODULES.map(m => {
          const isReady = !!health.data
          return (
            <Link
              key={m.to}
              to={m.to}
              className="glass-panel glass-hover gsap-reveal group flex flex-col p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#ff963f]/30 bg-gradient-to-br from-[#e87528]/20 to-[#c85a1b]/10 text-[#ff963f] shadow-[0_0_20px_rgba(232,117,40,0.18)]">
                  <m.icon className="h-5 w-5" />
                </div>
                <Badge color={isReady ? '#43c995' : '#82776f'}>
                  {isReady ? 'Operational' : 'Checking'}
                </Badge>
              </div>
              <h2 className="mt-5 text-[17px] font-semibold tracking-tight text-[#f7f3ee]">{m.name}</h2>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[#b9aea4]">{m.desc}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.tech.map(t => (
                  <span
                    key={t}
                    className="rounded-lg border border-white/[0.08] bg-[#14110f] px-2.5 py-0.5 text-[11px] font-medium text-[#b9aea4]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-[#ff963f]">
                Open {m.name}
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
      </section>

      {/* Analytics */}
      <section className="grid gap-4 lg:grid-cols-3">
        <GlassPanel
          title="Processing activity"
          subtitle="Minutes of audio processed per day"
          className="gsap-reveal lg:col-span-2"
        >
          {s && s.activity.length ? (
            <div className="h-56">
              <ResponsiveContainer>
                <AreaChart data={s.activity}>
                  <defs>
                    <linearGradient id="nasActivityGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e87528" stopOpacity={0.42} />
                      <stop offset="100%" stopColor="#e87528" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#82776f" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#82776f" fontSize={11} tickLine={false} axisLine={false} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(20, 17, 15, 0.96)',
                      border: '1px solid rgba(255,150,63,0.28)',
                      borderRadius: 12,
                      fontSize: 12,
                      color: '#f7f3ee',
                      backdropFilter: 'blur(16px)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="#ff963f"
                    strokeWidth={2}
                    fill="url(#nasActivityGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty icon={<Waves className="h-5 w-5" />} title="No processing activity yet">
              Process a recording in LinguaVoice, VoiceID or MeetingLens to track daily usage.
            </Empty>
          )}
        </GlassPanel>

        <GlassPanel
          title="Languages detected"
          subtitle="Sessions by detected source language"
          className="gsap-reveal"
        >
          {langData.length ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={langData}
                      dataKey="value"
                      innerRadius={44}
                      outerRadius={70}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {langData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(20, 17, 15, 0.96)',
                        border: '1px solid rgba(255,150,63,0.28)',
                        borderRadius: 12,
                        fontSize: 12,
                        color: '#f7f3ee',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2 text-xs">
                {langData.map((l, i) => (
                  <li key={l.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[#b9aea4]">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {l.name}
                    </span>
                    <span className="font-mono text-[#82776f]">{l.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty icon={<Languages className="h-5 w-5" />} title="No language data yet">
              Detected source languages will appear here after your first session.
            </Empty>
          )}
        </GlassPanel>
      </section>

      {/* Recent Sessions */}
      <GlassPanel
        title="Recent sessions"
        subtitle="Latest audio intelligence runs stored in SQLite"
        className="gsap-reveal"
        action={
          <Link to="/history" className="text-xs font-semibold text-[#ff963f] hover:underline">
            View all
          </Link>
        }
      >
        {s && s.recent.length ? (
          <div className="divide-y divide-white/[0.06]">
            {s.recent.map(r => (
              <Link
                key={r.id}
                to={r.kind === 'meeting' ? `/meetings/${r.id}` : `/history?open=${r.id}`}
                className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition hover:bg-white/[0.04]"
              >
                <Badge
                  color={
                    r.kind === 'meeting'
                      ? '#ffb45c'
                      : r.kind === 'speakers'
                        ? '#43c995'
                        : '#ff963f'
                  }
                >
                  {KIND_LABEL[r.kind] ?? r.kind}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#f7f3ee]">
                  {r.title}
                </span>
                <span className="hidden text-xs text-[#b9aea4] sm:block">
                  {langName(r.language)}
                </span>
                <span className="font-mono text-xs text-[#82776f]">
                  {fmtDuration(r.duration)}
                </span>
                <span className="hidden w-32 text-right text-xs text-[#82776f] md:block">
                  {fmtDate(r.created_at)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Empty icon={<AudioLines className="h-5 w-5" />} title="No conversations yet">
            Your processed audio sessions will appear here.
          </Empty>
        )}
      </GlassPanel>
    </div>
  )
}
