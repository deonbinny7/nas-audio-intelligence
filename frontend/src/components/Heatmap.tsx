import { useEffect, useRef } from 'react'
import type { Heatmap as H } from '../types'

// perceptual "magma-like" colour map
const STOPS: [number, number, number][] = [[4, 6, 20], [40, 17, 90], [114, 31, 129], [183, 55, 121], [241, 96, 93], [254, 176, 120], [252, 253, 191]]
function color(v: number): [number, number, number] {
  const x = (v / 255) * (STOPS.length - 1)
  const i = Math.min(STOPS.length - 2, Math.floor(x)), f = x - i
  return STOPS[i].map((c, k) => Math.round(c + (STOPS[i + 1][k] - c) * f)) as [number, number, number]
}

/** Renders a (rows x cols) 0..255 matrix as an image; low rows at the bottom. */
export function Heatmap({ data, height = 140, yLabel }: { data: H; height?: number; yLabel?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c || !data.rows) return
    c.width = data.cols; c.height = data.rows
    const g = c.getContext('2d')!
    const img = g.createImageData(data.cols, data.rows)
    for (let r = 0; r < data.rows; r++) for (let col = 0; col < data.cols; col++) {
      const [R, G, B] = color(data.data[r][col])
      const idx = ((data.rows - 1 - r) * data.cols + col) * 4
      img.data[idx] = R; img.data[idx + 1] = G; img.data[idx + 2] = B; img.data[idx + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, [data])
  return (
    <div className="relative">
      <canvas ref={ref} className="w-full rounded-lg" style={{ height, imageRendering: 'pixelated' }} />
      {yLabel && <span className="absolute top-1 left-2 rounded bg-black/50 px-1.5 text-[10px] text-slate-300">{yLabel}</span>}
      <span className="absolute right-2 bottom-1 rounded bg-black/50 px-1.5 font-mono text-[10px] text-slate-300">{data.min.toFixed(0)} … {data.max.toFixed(0)} {data.unit ?? "dB"}</span>
    </div>
  )
}

export function EnvelopeChart({ data, color = '#E87528', height = 70, vad, duration }: { data: [number, number][]; color?: string; height?: number; vad?: { start: number; end: number }[]; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = height
    c.width = w * dpr; c.height = h * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    if (vad && duration) {
      g.fillStyle = 'rgba(67,201,149,0.14)'
      for (const v of vad) g.fillRect((v.start / duration) * w, 0, ((v.end - v.start) / duration) * w, h)
    }
    g.fillStyle = color
    const bw = w / Math.max(1, data.length)
    data.forEach(([lo, hi], i) => {
      const y1 = h / 2 - hi * (h / 2), y2 = h / 2 - lo * (h / 2)
      g.fillRect(i * bw, y1, Math.max(1, bw), Math.max(1, y2 - y1))
    })
  }, [data, color, height, vad, duration])
  return <canvas ref={ref} className="w-full" style={{ height }} />
}
