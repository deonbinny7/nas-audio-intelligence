import { useEffect, useRef, useState } from 'react'
import { FileAudio, Mic, Square, Trash2, Upload } from 'lucide-react'
import { useRecorder } from '../hooks/useRecorder'
import { useToast } from './Toast'
import { cx } from './ui'
import { fmtTime } from './format'

/** Upload a file or record from the microphone; reports the chosen audio Blob. */
export function AudioInput({ onChange, compact }: { onChange: (b: Blob | null) => void; compact?: boolean }) {
  const [mode, setMode] = useState<'upload' | 'record'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const rec = useRecorder()
  const toast = useToast()
  const current: Blob | null = mode === 'upload' ? file : rec.blob
  const url = useObjectUrl(current)

  useEffect(() => {
    onChange(current)
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (f: File | undefined | null) => {
    if (!f) return
    setFile(f)
    toast.info('Audio ready', `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1 text-[13px]">
        {(['upload', 'record'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cx(
              'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg py-1.5 font-medium transition-all duration-150',
              mode === m
                ? 'bg-[#e87528]/18 text-[#f7f3ee] border border-[#ff963f]/30'
                : 'text-[#82776f] hover:text-[#f7f3ee]',
            )}
          >
            {m === 'upload' ? <Upload className="h-3.5 w-3.5 text-[#ff963f]" /> : <Mic className="h-3.5 w-3.5 text-[#ff963f]" />}
            {m === 'upload' ? 'Upload audio' : 'Record mic'}
          </button>
        ))}
      </div>

      {mode === 'upload' ? (
        <div
          onDragOver={e => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => {
            e.preventDefault()
            setDrag(false)
            pick(e.dataTransfer.files?.[0])
          }}
          onClick={() => inputRef.current?.click()}
          className={cx(
            'group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 text-center transition-all duration-200',
            compact ? 'py-6' : 'py-9',
            drag
              ? 'border-[#ff963f] bg-[#e87528]/12'
              : 'border-[#e87528]/30 bg-white/[0.02] hover:border-[#ff963f]/65 hover:bg-[#e87528]/[0.06]',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.ogg,.webm,.flac,.mp4"
            className="hidden"
            onChange={e => pick(e.target.files?.[0])}
          />
          {file ? (
            <div className="flex items-center gap-3.5 text-left">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff963f]/35 bg-[#e87528]/18 text-[#ff963f]">
                <FileAudio className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="max-w-[230px] truncate text-[13px] font-medium text-[#f7f3ee]">
                  {file.name}
                </div>
                <div className="mt-0.5 text-[11px] text-[#b9aea4]">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · Click to replace
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#e87528]/25 bg-[#e87528]/10 text-[#ff963f] transition group-hover:border-[#ff963f]/50">
                <Upload className="h-4 w-4" />
              </div>
              <p className="text-[13px] font-medium text-[#f7f3ee]">Drop audio file or browse</p>
              <p className="mt-1 text-[11px] text-[#82776f]">
                WAV, MP3, M4A, OGG, WEBM, FLAC · up to 100 MB
              </p>
            </>
          )}
        </div>
      ) : (
        <div
          className={cx(
            'flex flex-col items-center rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4',
            compact ? 'py-5' : 'py-8',
          )}
        >
          <div className="mb-3.5 flex h-10 items-end gap-1">
            {Array.from({ length: 24 }).map((_, i) => {
              const h = rec.recording
                ? Math.max(
                    4,
                    rec.level * 40 * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + rec.seconds * 6))),
                  )
                : 4
              return (
                <span
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-[#c85a1b] via-[#e87528] to-[#ffb45c] transition-all duration-100"
                  style={{ height: h }}
                />
              )
            })}
          </div>
          <div className="mb-4 font-mono text-2xl font-medium tracking-tight text-[#f7f3ee]">
            {fmtTime(rec.seconds)}
          </div>
          <div className="flex items-center gap-2">
            {!rec.recording ? (
              <button
                type="button"
                onClick={rec.start}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-br from-[#ff963f] to-[#e87528] px-5 py-2 text-[13px] font-semibold text-[#080808] shadow-lg shadow-[#e87528]/30 transition hover:brightness-110 active:scale-[0.98]"
              >
                <Mic className="h-3.5 w-3.5" /> {rec.blob ? 'Record again' : 'Start recording'}
              </button>
            ) : (
              <button
                type="button"
                onClick={rec.stop}
                className="flex cursor-pointer items-center gap-2 rounded-full bg-[#f7f3ee] px-5 py-2 text-[13px] font-semibold text-[#080808] transition hover:bg-white active:scale-[0.98]"
              >
                <Square className="h-3.5 w-3.5" /> Stop
              </button>
            )}
            {rec.blob && !rec.recording && (
              <button
                type="button"
                onClick={rec.reset}
                className="cursor-pointer rounded-full border border-white/12 p-2 text-[#82776f] transition hover:bg-white/10 hover:text-[#f7f3ee]"
                aria-label="Discard recording"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          {rec.error && <p className="mt-3 text-xs text-[#f47769]">{rec.error}</p>}
        </div>
      )}

      {url && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <audio src={url} controls className="h-8 w-full" />
        </div>
      )}
    </div>
  )
}

export function useObjectUrl(b: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!b) {
      setUrl(null)
      return
    }
    const u = URL.createObjectURL(b)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [b])
  return url
}
