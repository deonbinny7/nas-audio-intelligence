import { fmtTime, speakerColor, speakerName } from './format'
import type { SpeakerTurn } from '../types'

/** Gantt-style speaker activity timeline: one lane per speaker. */
export function SpeakerTimeline({
  turns,
  duration,
  onSeek,
  currentTime,
}: {
  turns: SpeakerTurn[]
  duration: number
  onSeek?: (t: number, end: number) => void
  currentTime?: number
}) {
  const ids = [...new Set(turns.map(t => t.speaker_id))].sort()
  const ticks = Array.from({ length: 6 }, (_, i) => (duration / 5) * i)

  return (
    <div className="space-y-2.5">
      {ids.map(id => (
        <div key={id} className="flex items-center gap-3">
          <div
            className="w-24 shrink-0 truncate text-xs font-medium"
            style={{ color: speakerColor(id) }}
          >
            {speakerName(id)}
          </div>
          <div className="relative h-7 flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03]">
            {turns
              .filter(t => t.speaker_id === id)
              .map((t, i) => (
                <button
                  key={i}
                  type="button"
                  title={`${fmtTime(t.start)}–${fmtTime(t.end)}${t.confidence != null ? ` · similarity ${t.confidence}` : ''}`}
                  onClick={() => onSeek?.(t.start, t.end)}
                  className="absolute top-1 bottom-1 cursor-pointer rounded-md transition-all duration-150 hover:brightness-125 hover:scale-y-105"
                  style={{
                    left: `${(t.start / duration) * 100}%`,
                    width: `${Math.max(0.5, ((t.end - t.start) / duration) * 100)}%`,
                    background: speakerColor(id),
                    opacity: 0.85,
                  }}
                />
              ))}
            {currentTime !== undefined && duration > 0 && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#fce0c4]/85 shadow-[0_0_6px_rgba(252,224,196,0.65)]"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              />
            )}
          </div>
        </div>
      ))}
      <div className="flex pl-[108px] font-mono text-[10px] text-[#82776f]">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="flex-1"
            style={{
              textAlign: i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : 'center',
            }}
          >
            {fmtTime(t)}
          </span>
        ))}
      </div>
    </div>
  )
}
