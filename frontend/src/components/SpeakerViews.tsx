import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import type { SpeakerStat, VoiceIdResult } from '../types'
import { Badge, GlassPanel } from './ui'
import { fmtTime, langName, speakerColor, speakerName } from './format'

export function SpeakerCards({ stats }: { stats: SpeakerStat[] }) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(s => {
        const col = speakerColor(s.speaker_id)
        return (
          <div
            key={s.speaker_id}
            className="glass-panel-2 glass-hover p-4"
            style={{ borderColor: col + '38' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#080808]"
                style={{ background: col }}
              >
                {String(Number(s.speaker_id.slice(-2)) + 1).padStart(2, '0')}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold text-[#f7f3ee]">
                  {speakerName(s.speaker_id)}
                </div>
                <div className="font-mono text-[10px] text-[#82776f]">{s.speaker_id}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="font-mono text-base font-semibold text-[#f7f3ee]">
                  {s.percentage}%
                </div>
                <div className="text-[10px] text-[#82776f]">share</div>
              </div>
            </div>

            <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${s.percentage}%`, background: col }}
              />
            </div>

            <dl className="mt-3.5 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-[10px] text-[#82776f]">Talk time</dt>
                <dd className="mt-0.5 font-mono text-[#f7f3ee]">{s.total_duration.toFixed(1)}s</dd>
              </div>
              <div>
                <dt className="text-[10px] text-[#82776f]">Turns</dt>
                <dd className="mt-0.5 font-mono text-[#f7f3ee]">{s.segment_count}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-[#82776f]">Active</dt>
                <dd className="mt-0.5 font-mono text-[#f7f3ee]">
                  {fmtTime(s.first_seen)}–{fmtTime(s.last_seen)}
                </dd>
              </div>
            </dl>

            {(s.languages?.length || s.enrolled_match) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.languages?.map(l => (
                  <Badge key={l} color="#ffb45c">
                    {langName(l)}
                    {s.language_probability != null ? ` ${Math.round(s.language_probability * 100)}%` : ''}
                  </Badge>
                ))}
                {s.enrolled_match && (
                  <Badge color={s.enrolled_match.matched ? '#43c995' : '#82776f'}>
                    {s.enrolled_match.matched
                      ? `≈ ${s.enrolled_match.name}`
                      : `closest: ${s.enrolled_match.name}`}{' '}
                    ({s.enrolled_match.similarity})
                  </Badge>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function SimilarityMatrix({ data }: { data: VoiceIdResult['similarity_matrix'] }) {
  if (data.speaker_ids.length < 2) {
    return <p className="text-sm text-[#82776f]">Need at least two speakers to compare.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th />
            {data.speaker_ids.map(id => (
              <th
                key={id}
                className="px-2 pb-2 font-medium"
                style={{ color: speakerColor(id) }}
              >
                {speakerName(id).replace('Speaker ', 'S')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.matrix.map((row, i) => (
            <tr key={i}>
              <td
                className="pr-3 font-medium whitespace-nowrap"
                style={{ color: speakerColor(data.speaker_ids[i]) }}
              >
                {speakerName(data.speaker_ids[i])}
              </td>
              {row.map((v, j) => (
                <td key={j} className="p-0.5">
                  <div
                    className="flex h-11 w-14 items-center justify-center rounded-lg font-mono text-[11px] text-[#f7f3ee] transition hover:ring-1 hover:ring-[#ff963f]/50"
                    style={{
                      background:
                        v == null
                          ? 'rgba(255,255,255,0.04)'
                          : `rgba(232,117,40,${Math.max(0.08, Math.min(0.85, v))})`,
                    }}
                  >
                    {v?.toFixed(2) ?? '—'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] leading-relaxed text-[#82776f]">
        Cosine similarity of speaker centroid embeddings: sim(A,B) = A·B / (‖A‖‖B‖). Higher indicates closer acoustic similarity, not definitive proof of identity.
      </p>
    </div>
  )
}

export function EmbeddingScatter({
  points,
  dim,
}: {
  points: VoiceIdResult['embedding_projection']
  dim: number
}) {
  const ids = [...new Set(points.map(p => p.speaker_id))].sort()
  return (
    <GlassPanel
      title="Embedding space"
      subtitle={`${dim}-d ECAPA-TDNN window embeddings projected to 2-D via PCA`}
    >
      {points.length ? (
        <div className="h-64">
          <ResponsiveContainer>
            <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" dataKey="x" stroke="#82776f" fontSize={10} tickLine={false} />
              <YAxis type="number" dataKey="y" stroke="#82776f" fontSize={10} tickLine={false} />
              <ZAxis range={[42, 42]} />
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
              {ids.map(id => (
                <Scatter
                  key={id}
                  name={speakerName(id)}
                  data={points.filter(p => p.speaker_id === id)}
                  fill={speakerColor(id)}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm text-[#82776f]">Not enough speech windows to plot.</p>
      )}
    </GlassPanel>
  )
}
