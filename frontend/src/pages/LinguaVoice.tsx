import { useRef, useState } from 'react'
import { ArrowRight, Check, Copy, Download, FileText, Languages, Sparkles, Volume2 } from 'lucide-react'
import { AudioInput } from '../components/AudioInput'
import { ProcessingExplanation } from '../components/ProcessingExplanation'
import { useToast } from '../components/Toast'
import { AudioActivityBars, Badge, Button, ErrorBanner, GlassPanel, Metric, Notice, PageHeader, Select } from '../components/ui'
import { langName } from '../components/format'
import { EXPLANATIONS } from '../data/explanations'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api, errorMessage } from '../services/api'
import type { TranscribeResult, TranslateResult } from '../types'

export default function LinguaVoice() {
  const rootRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(rootRef, [])
  const langs = useAsync(() => api.languages(), [])
  const toast = useToast()
  const [audio, setAudio] = useState<Blob | null>(null)
  const [target, setTarget] = useState('ml')
  const [source, setSource] = useState('')
  const [gender, setGender] = useState('female')
  const [busy, setBusy] = useState<'translate' | 'transcribe' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [asr, setAsr] = useState<TranscribeResult | null>(null)
  const [text, setText] = useState('')
  const [textOut, setTextOut] = useState<{ text: string; audio?: string } | null>(null)
  const [textBusy, setTextBusy] = useState(false)
  const [copied, setCopied] = useState<'orig' | 'trans' | null>(null)

  const langOpts = (langs.data ?? []).map(l => ({ value: l.code, label: `${l.name} · ${l.native}` }))

  const copyText = async (val: string, key: 'orig' | 'trans') => {
    try {
      await navigator.clipboard.writeText(val)
      setCopied(key)
      toast.success('Copied to clipboard')
      setTimeout(() => setCopied(null), 1800)
    } catch {
      toast.error('Copy failed')
    }
  }

  const downloadTranscript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const run = async (mode: 'translate' | 'transcribe') => {
    if (!audio) return
    setBusy(mode)
    setError(null)
    setResult(null)
    setAsr(null)
    try {
      if (mode === 'translate') {
        const res = await api.translate(audio, target, { source_language: source || undefined, gender })
        setResult(res)
        toast.success('Translation complete', `Detected ${langName(res.source_language)} → ${langName(res.target_language)}`)
      } else {
        const res = await api.transcribe(audio, source || undefined)
        setAsr(res)
        toast.success('Transcription complete', `Detected ${langName(res.language)}`)
      }
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error('Processing failed', msg)
    } finally {
      setBusy(null)
    }
  }

  const runText = async () => {
    setTextBusy(true)
    setError(null)
    setTextOut(null)
    try {
      const t = await api.translateText(text, target)
      let audioUrl: string | undefined
      try {
        audioUrl = (await api.tts(t.translated_text, target, gender)).audio_url
      } catch {
        /* speech synthesis is optional */
      }
      setTextOut({ text: t.translated_text, audio: audioUrl })
      toast.success('Text translated')
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error('Translation failed', msg)
    } finally {
      setTextBusy(false)
    }
  }

  return (
    <div ref={rootRef}>
      <PageHeader
        eyebrow="Speech & Translation"
        icon={<Languages className="h-5 w-5" />}
        title="LinguaVoice"
        subtitle="Multilingual speech recognition, translation and neural speech synthesis"
      />

      <div className="gsap-reveal grid gap-6 lg:grid-cols-[390px_1fr]">
        {/* Left Column */}
        <div className="space-y-4">
          <GlassPanel title="1 · Audio input" subtitle="Upload an audio file or record from your microphone">
            <AudioInput onChange={setAudio} />
          </GlassPanel>

          <GlassPanel title="2 · Languages & voice">
            <div className="space-y-3.5">
              <div>
                <div className="label mb-1.5">Source language</div>
                <Select
                  value={source}
                  onChange={setSource}
                  options={[{ value: '', label: 'Auto-detect (Whisper language ID)' }, ...langOpts]}
                />
              </div>
              <div>
                <div className="label mb-1.5">Translate to</div>
                <Select value={target} onChange={setTarget} options={langOpts} />
              </div>
              <div>
                <div className="label mb-1.5">Synthesised voice</div>
                <Select
                  value={gender}
                  onChange={setGender}
                  options={[
                    { value: 'female', label: 'Female neural voice' },
                    { value: 'male', label: 'Male neural voice' },
                  ]}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <Button
                  className="flex-1"
                  disabled={!audio || !!busy}
                  loading={busy === 'translate'}
                  onClick={() => run('translate')}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Translate speech
                </Button>
                <Button
                  variant="secondary"
                  disabled={!audio || !!busy}
                  loading={busy === 'transcribe'}
                  onClick={() => run('transcribe')}
                  icon={<FileText className="h-4 w-4" />}
                >
                  Transcribe
                </Button>
              </div>

              {busy && (
                <div className="flex items-center gap-3 rounded-xl border border-[#e87528]/30 bg-[#e87528]/[0.08] px-3.5 py-2.5 text-xs leading-relaxed text-[#fce0c4]">
                  <AudioActivityBars active />
                  <span>
                    Running Whisper ASR on CPU{busy === 'translate' ? ', Gemini translation and Edge TTS' : ''}…
                  </span>
                </div>
              )}
            </div>
          </GlassPanel>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <ErrorBanner message={error} onClose={() => setError(null)} />

          {result && (
            <>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
                <Metric
                  label="Detected language"
                  value={langName(result.source_language)}
                  hint={
                    result.source_language_probability != null
                      ? `p = ${result.source_language_probability.toFixed(3)}`
                      : undefined
                  }
                />
                {Object.entries(result.timings).map(([k, v]) => (
                  <Metric key={k} label={k.replace('_', ' ')} value={`${v.toFixed(2)} s`} />
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
                <GlassPanel
                  title={
                    <span className="flex items-center gap-2">
                      Original <Badge color="#b9aea4">{langName(result.source_language)}</Badge>
                    </span>
                  }
                  action={
                    <button
                      type="button"
                      onClick={() => copyText(result.original_text, 'orig')}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#b9aea4] transition hover:bg-white/[0.08] hover:text-[#f7f3ee]"
                    >
                      {copied === 'orig' ? <Check className="h-3 w-3 text-[#43c995]" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                  }
                >
                  <p className="text-[16px] leading-relaxed text-[#f7f3ee]">{result.original_text}</p>
                  {result.input_audio_url && (
                    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
                      <audio src={result.input_audio_url} controls className="h-8 w-full" />
                    </div>
                  )}
                </GlassPanel>

                <div className="hidden items-center justify-center md:flex">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e87528]/30 bg-[#e87528]/15 text-[#ff963f]">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                <GlassPanel
                  title={
                    <span className="flex items-center gap-2">
                      Translation <Badge color="#ff963f">{langName(result.target_language)}</Badge>
                    </span>
                  }
                  action={
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => copyText(result.translated_text, 'trans')}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#b9aea4] transition hover:bg-white/[0.08] hover:text-[#f7f3ee]"
                      >
                        {copied === 'trans' ? <Check className="h-3 w-3 text-[#43c995]" /> : <Copy className="h-3 w-3" />}
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadTranscript(
                            `Original (${langName(result.source_language)}):\n${result.original_text}\n\nTranslation (${langName(result.target_language)}):\n${result.translated_text}\n`,
                            `linguavoice-${result.session_id}.txt`,
                          )
                        }
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#b9aea4] transition hover:bg-white/[0.08] hover:text-[#f7f3ee]"
                      >
                        <Download className="h-3 w-3" />
                        TXT
                      </button>
                    </div>
                  }
                >
                  <p className="text-[16px] leading-relaxed text-[#f7f3ee]">{result.translated_text}</p>
                  {result.audio_url ? (
                    <div className="mt-4 space-y-2.5">
                      <div className="flex items-center gap-2 text-xs text-[#b9aea4]">
                        <Volume2 className="h-3.5 w-3.5 text-[#ffb45c]" /> {result.voice}
                      </div>
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
                        <audio src={result.audio_url} controls autoPlay className="h-8 w-full" />
                      </div>
                      <a
                        href={result.audio_url}
                        download
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ff963f] hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" /> Download translated speech (MP3)
                      </a>
                    </div>
                  ) : (
                    result.tts_error && <Notice tone="warn">{result.tts_error}</Notice>
                  )}
                </GlassPanel>
              </div>

              {result.segments.length > 1 && (
                <GlassPanel title="Recognised segments" subtitle="Whisper timestamps">
                  <ul className="space-y-2 font-mono text-xs">
                    {result.segments.map(s => (
                      <li key={s.id} className="flex gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                        <span className="shrink-0 text-[#82776f]">
                          [{s.start.toFixed(2)} – {s.end.toFixed(2)}]
                        </span>
                        <span className="font-sans text-[13px] text-[#f7f3ee]">{s.text}</span>
                      </li>
                    ))}
                  </ul>
                </GlassPanel>
              )}

              <ProcessingExplanation
                entries={[
                  EXPLANATIONS.linguavoice.audio_preprocessing,
                  EXPLANATIONS.linguavoice.speech_recognition,
                  EXPLANATIONS.linguavoice.translation,
                  ...(result.audio_url ? [EXPLANATIONS.linguavoice.speech_synthesis] : []),
                ]}
              />
            </>
          )}

          {asr && (
            <>
              <GlassPanel
                title="Transcription"
                subtitle={`Whisper ${asr.model} · ${asr.processing_time}s · real-time factor ${asr.real_time_factor ?? '—'}`}
                action={
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyText(asr.text, 'orig')}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#b9aea4] transition hover:bg-white/[0.08] hover:text-[#f7f3ee]"
                    >
                      {copied === 'orig' ? <Check className="h-3 w-3 text-[#43c995]" /> : <Copy className="h-3 w-3" />}
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadTranscript(asr.text, `transcript-${asr.session_id}.txt`)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-[#b9aea4] transition hover:bg-white/[0.08] hover:text-[#f7f3ee]"
                    >
                      <Download className="h-3 w-3" />
                      TXT
                    </button>
                  </div>
                }
              >
                <div className="mb-3.5 flex flex-wrap gap-2">
                  {asr.language_candidates.map(c => (
                    <Badge key={c.code} color={c.code === asr.language ? '#ff963f' : '#82776f'}>
                      {langName(c.code)} {(c.probability * 100).toFixed(1)}%
                    </Badge>
                  ))}
                </div>
                <p className="text-[16px] leading-relaxed text-[#f7f3ee]">
                  {asr.text || <span className="text-[#82776f]">No speech recognised.</span>}
                </p>
                <ul className="mt-4 space-y-1.5 font-mono text-xs">
                  {asr.segments.map(s => (
                    <li key={s.id} className="flex gap-3 rounded-xl bg-white/[0.03] px-3 py-1.5">
                      <span className="shrink-0 text-[#82776f]">
                        [{s.start.toFixed(2)} – {s.end.toFixed(2)}]
                      </span>
                      <span className="font-sans text-[13px] text-[#b9aea4]">{s.text}</span>
                    </li>
                  ))}
                </ul>
              </GlassPanel>

              <ProcessingExplanation
                entries={[
                  EXPLANATIONS.linguavoice.audio_preprocessing,
                  EXPLANATIONS.linguavoice.transcription,
                ]}
              />
            </>
          )}

          {!result && !asr && (
            <GlassPanel title="Processing pipeline" subtitle="How LinguaVoice transforms speech across languages">
              <ol className="grid gap-2.5 text-[13px] text-[#b9aea4] sm:grid-cols-2">
                {[
                  'Audio decode & 16 kHz mono resampling',
                  'Spectral-gating noise reduction',
                  'Whisper ASR & language identification',
                  'Gemini contextual translation',
                  'Edge neural speech synthesis',
                  'Interactive playback & export',
                ].map((step, i) => (
                  <li
                    key={step}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3.5 py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e87528]/18 font-mono text-[11px] font-medium text-[#ff963f]">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </GlassPanel>
          )}

          {/* Text Translator */}
          <GlassPanel
            title="Text translator"
            subtitle="Translate typed text directly using the target language and neural voice selected on the left"
          >
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={3}
              className="input resize-none"
              placeholder="Enter text to translate and synthesise…"
            />
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <Button variant="secondary" disabled={!text.trim()} loading={textBusy} onClick={runText}>
                Translate & speak
              </Button>
              {textOut && <span className="text-sm font-medium text-[#f7f3ee]">{textOut.text}</span>}
            </div>
            {textOut?.audio && (
              <div className="mt-3.5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
                <audio src={textOut.audio} controls autoPlay className="h-8 w-full" />
              </div>
            )}
            {textOut && (
              <ProcessingExplanation
                className="mt-4"
                entries={[
                  EXPLANATIONS.linguavoice.text_translation,
                  ...(textOut.audio ? [EXPLANATIONS.linguavoice.speech_synthesis] : []),
                ]}
              />
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  )
}
