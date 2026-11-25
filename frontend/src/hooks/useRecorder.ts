import { useCallback, useEffect, useRef, useState } from 'react'

/** Browser microphone recording via MediaRecorder + a live input level meter (Web Audio API). */
export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const raf = useRef<number>(0)
  const timer = useRef<number>(0)
  const ctx = useRef<AudioContext | null>(null)
  const stream = useRef<MediaStream | null>(null)

  const cleanup = () => {
    cancelAnimationFrame(raf.current)
    clearInterval(timer.current)
    stream.current?.getTracks().forEach(t => t.stop())
    ctx.current?.close().catch(() => {})
    ctx.current = null
    setLevel(0)
  }

  const start = useCallback(async () => {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      const ac = new AudioContext()
      ctx.current = ac
      const an = ac.createAnalyser()
      an.fftSize = 1024
      ac.createMediaStreamSource(s).connect(an)
      const buf = new Uint8Array(an.fftSize)
      const tick = () => {
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (const v of buf) sum += ((v - 128) / 128) ** 2
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4))
        raf.current = requestAnimationFrame(tick)
      }
      tick()
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const mr = new MediaRecorder(s, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      mr.ondataavailable = e => e.data.size && chunks.current.push(e.data)
      mr.onstop = () => {
        setBlob(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }))
        cleanup()
      }
      mr.start(250)
      rec.current = mr
      setBlob(null)
      setSeconds(0)
      const t0 = Date.now()
      timer.current = window.setInterval(() => setSeconds((Date.now() - t0) / 1000), 200)
      setRecording(true)
    } catch (e) {
      setError(e instanceof Error ? `Microphone unavailable: ${e.message}` : 'Microphone unavailable')
      cleanup()
    }
  }, [])

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop()
    setRecording(false)
  }, [])

  const reset = useCallback(() => { setBlob(null); setSeconds(0) }, [])

  useEffect(() => () => cleanup(), [])
  return { recording, blob, seconds, level, error, start, stop, reset }
}
