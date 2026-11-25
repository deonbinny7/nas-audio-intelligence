import { useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { History as HistoryIcon, Search, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import { ProcessingExplanation } from '../components/ProcessingExplanation'
import { Badge, Button, ConfirmModal, Empty, ErrorBanner, GlassPanel, PageHeader, Tabs } from '../components/ui'
import { fmtDate, fmtDuration, langName } from '../components/format'
import { EXPLANATIONS } from '../data/explanations'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api } from '../services/api'

const KINDS = {
  all: 'All',
  meeting: 'MeetingLens',
  speakers: 'VoiceID',
  translate: 'LinguaVoice',
  transcribe: 'Transcriptions',
} as const
type Kind = keyof typeof KINDS
const COLORS: Record<string, string> = {
  meeting: '#ffb45c',
  speakers: '#43c995',
  translate: '#ff963f',
  transcribe: '#b9aea4',
}

export default function HistoryPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(rootRef, [])
  const toast = useToast()
  const [kind, setKind] = useState<Kind>('all')
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const open = params.get('open')
  const list = useAsync(() => api.history(kind === 'all' ? undefined : kind), [kind])
  const detail = useAsync(() => (open ? api.historyItem(open) : Promise.resolve(null)), [open])

  const filtered = useMemo(() => {
    const items = list.data ?? []
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      r => r.title.toLowerCase().includes(q) || r.filename.toLowerCase().includes(q),
    )
  }, [list.data, query])

  return (
    <div ref={rootRef}>
      <PageHeader
        eyebrow="Session Library"
        icon={<HistoryIcon className="h-5 w-5" />}
        title="History"
        subtitle="Every recording, transcript and report processed by NAS, persisted in SQLite"
      />

      <div className="gsap-reveal mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <Tabs
          value={kind}
          onChange={setKind}
          tabs={(Object.keys(KINDS) as Kind[]).map(k => ({ id: k, label: KINDS[k] }))}
        />
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#82776f]" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search sessions…"
            className="input pl-9 text-xs"
          />
        </div>
      </div>

      <ErrorBanner message={list.error} />

      <div className="gsap-reveal grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <GlassPanel>
          {filtered.length ? (
            <div className="divide-y divide-white/[0.06]">
              {filtered.map(r => (
                <div
                  key={r.id}
                  className="-mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 transition hover:bg-white/[0.04]"
                >
                  <Badge color={COLORS[r.kind]}>{KINDS[r.kind as Kind] ?? r.kind}</Badge>
                  {r.kind === 'meeting' ? (
                    <Link
                      to={`/meetings/${r.id}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium text-[#f7f3ee] transition hover:text-[#ff963f]"
                    >
                      {r.title}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setParams({ open: r.id })}
                      className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium text-[#f7f3ee] transition hover:text-[#ff963f]"
                    >
                      {r.title}
                    </button>
                  )}
                  <span className="hidden text-xs text-[#b9aea4] md:block">
                    {langName(r.language)}
                  </span>
                  <span className="font-mono text-xs text-[#82776f]">
                    {fmtDuration(r.duration)}
                  </span>
                  <span className="hidden w-28 text-right text-xs text-[#82776f] sm:block">
                    {fmtDate(r.created_at)}
                  </span>
                  <button
                    type="button"
                    title="Delete session"
                    onClick={() => setDeleteTarget({ id: r.id, title: r.title })}
                    className="cursor-pointer rounded-lg p-1.5 text-[#82776f] transition hover:bg-[#f47769]/10 hover:text-[#f47769]"
                    aria-label={`Delete ${r.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={<HistoryIcon className="h-5 w-5" />}
              title="No conversations yet"
              action={
                <Link to="/meetinglens">
                  <Button size="sm" variant="secondary">
                    Start a new session
                  </Button>
                </Link>
              }
            >
              Your processed audio sessions will appear here.
            </Empty>
          )}
        </GlassPanel>
        {filtered.length > 0 && <ProcessingExplanation entries={EXPLANATIONS.history.storage} />}
        </div>

        {open && detail.data && (
          <GlassPanel
            title={detail.data.title}
            subtitle={`${KINDS[detail.data.kind as Kind] ?? detail.data.kind} · ${fmtDate(detail.data.created_at)}`}
            action={
              <Button variant="ghost" size="sm" onClick={() => setParams({})}>
                Close
              </Button>
            }
          >
            {detail.data.audio_url && (
              <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
                <audio src={detail.data.audio_url} controls className="h-8 w-full" />
              </div>
            )}
            <DetailBody result={detail.data.result as Record<string, unknown>} />
          </GlassPanel>
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete session record?"
        description={`This will permanently remove "${deleteTarget?.title}" from your session history.`}
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await api.deleteHistory(deleteTarget.id)
          if (open === deleteTarget.id) setParams({})
          toast.info('Session deleted', deleteTarget.title)
          setDeleteTarget(null)
          list.reload()
        }}
      />
    </div>
  )
}

function DetailBody({ result }: { result: Record<string, unknown> }) {
  const r = result as {
    original_text?: string
    translated_text?: string
    text?: string
    audio_url?: string
    speaker_count?: number
    speakers?: { speaker_id: string; start: number; end: number }[]
  }
  return (
    <div className="space-y-4 text-sm">
      {r.original_text && (
        <div>
          <div className="label mb-1">Original</div>
          <p className="leading-relaxed text-[#f7f3ee]">{r.original_text}</p>
        </div>
      )}
      {r.translated_text && (
        <div>
          <div className="label mb-1">Translation</div>
          <p className="leading-relaxed text-[#ffb45c]">{r.translated_text}</p>
        </div>
      )}
      {r.audio_url && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <audio src={r.audio_url} controls className="h-8 w-full" />
        </div>
      )}
      {r.text && !r.original_text && (
        <div>
          <div className="label mb-1">Transcript</div>
          <p className="leading-relaxed text-[#f7f3ee]">{r.text}</p>
        </div>
      )}
      {r.speaker_count !== undefined && (
        <div>
          <div className="label mb-1">Speakers</div>
          <p className="text-[#b9aea4]">
            {r.speaker_count} speakers, {r.speakers?.length} turns
          </p>
        </div>
      )}
    </div>
  )
}
