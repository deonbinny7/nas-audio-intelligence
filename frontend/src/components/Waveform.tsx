import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { fmtTime, speakerColor } from './format'

export interface WaveformHandle {
  playSegment: (start: number, end?: number) => void
  seek: (t: number) => void
}
interface Region {
  start: number
  end: number
  speaker_id: string
}

/**
 * Audio player with a canvas waveform (decoded with the Web Audio API),
 * speaker-coloured regions, click-to-seek and segment playback.
 */
export const Waveform = forwardRef<
  WaveformHandle,
  { src: string; regions?: Region[]; height?: number; onTime?: (t: number) => void }
>(function Waveform({ src, regions = [], height = 92, onTime }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const [duration, setDuration] = useState(0)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const stopAt = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setPeaks(null)
    ;(async () => {
      try {
        const buf = await (await fetch(src)).arrayBuffer()
        const ac = new AudioContext()
        const decoded = await ac.decodeAudioData(buf)
        ac.close()
        const data = decoded.getChannelData(0)
        const n = 900
        const chunk = Math.max(1, Math.floor(data.length / n))
        const p = new Float32Array(n)
        for (let i = 0; i < n; i++) {
          let m = 0
          for (let j = i * chunk; j < Math.min(data.length, (i + 1) * chunk); j++) {
            m = Math.max(m, Math.abs(data[j]))
          }
          p[i] = m
        }
        if (!cancelled) {
          setPeaks(p)
          setDuration(decoded.duration)
        }
      } catch {
        /* waveform optional; audio element still functions */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [src])

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth
    const h = height
    c.width = w * dpr
    c.height = h * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, w, h)
    const dur = duration || audio.current?.duration || 0
    if (dur) {
      for (const r of regions) {
        g.fillStyle = speakerColor(r.speaker_id) + '1c'
        g.fillRect((r.start / dur) * w, 0, ((r.end - r.start) / dur) * w, h)
        g.fillStyle = speakerColor(r.speaker_id)
        g.fillRect((r.start / dur) * w, h - 2.5, ((r.end - r.start) / dur) * w, 2.5)
      }
    }
    if (peaks) {
      const bw = w / peaks.length
      const max = Math.max(...peaks, 0.01)
      const played = dur ? time / dur : 0
      peaks.forEach((p, i) => {
        const bh = Math.max(1.5, (p / max) * (h - 14))
        g.fillStyle = i / peaks.length < played ? '#ffb45c' : '#3b332d'
        g.fillRect(i * bw, (h - 3) / 2 - bh / 2, Math.max(1, bw - 0.6), bh)
      })
    }
    if (dur) {
      g.fillStyle = '#fce0c4'
      g.fillRect((time / dur) * w - 0.75, 0, 1.5, h)
    }
  }, [peaks, time, duration, regions, height])

  const seek = (t: number) => {
    if (audio.current) {
      audio.current.currentTime = t
      setTime(t)
    }
  }

  useImperativeHandle(ref, () => ({
    seek,
    playSegment: (start, end) => {
      seek(start)
      stopAt.current = end ?? null
      audio.current?.play()
    },
  }))

  return (
    <div className="glass-panel-2 p-3.5 sm:p-4">
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={e => !duration && setDuration(e.currentTarget.duration)}
        onTimeUpdate={e => {
          const t = e.currentTarget.currentTime
          setTime(t)
          onTime?.(t)
          if (stopAt.current !== null && t >= stopAt.current) {
            e.currentTarget.pause()
            stopAt.current = null
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => {
            stopAt.current = null
            if (playing) audio.current?.pause()
            else audio.current?.play()
          }}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-[#ff963f] to-[#e87528] text-[#080808] shadow-[0_6px_20px_-4px_rgba(232,117,40,0.5)] transition hover:brightness-110 active:scale-95"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
        </button>
        <canvas
          ref={canvas}
          style={{ height }}
          className="w-full cursor-pointer rounded-lg"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            const dur = duration || audio.current?.duration || 0
            if (dur) seek(((e.clientX - r.left) / r.width) * dur)
          }}
        />
        <span className="hidden shrink-0 font-mono text-xs text-[#b9aea4] sm:inline">
          {fmtTime(time)} / {fmtTime(duration)}
        </span>
      </div>
    </div>
  )
})
