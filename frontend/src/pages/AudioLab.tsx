import { useRef, useState } from 'react'
import { ChevronDown, Waves } from 'lucide-react'
import { AudioAnalysisPanel } from '../components/AudioAnalysisPanel'
import { AudioInput } from '../components/AudioInput'
import { useToast } from '../components/Toast'
import { AudioActivityBars, Button, Empty, ErrorBanner, GlassPanel, PageHeader, cx } from '../components/ui'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api, errorMessage } from '../services/api'
import type { AudioAnalysis } from '../types'

const CONCEPTS = [
  {
    title: 'Sampling & Resampling (16 kHz Mono)',
    desc: 'Audio is mixed to mono and resampled to 16,000 Hz. By Nyquist theorem (8 kHz bandwidth), this captures all primary speech formants efficiently.',
  },
  {
    title: 'Framing & Hamming Window',
    desc: 'Signal is split into 25 ms frames with a 10 ms hop, then multiplied by a Hamming window w[n] = 0.54 − 0.46 cos(2πn/(N−1)) to reduce spectral leakage.',
  },
  {
    title: 'STFT & Mel Filterbank',
    desc: 'A 512-point Fast Fourier Transform extracts frequency magnitudes, mapped onto 64 triangular Mel filters approximating human auditory perception.',
  },
  {
    title: 'MFCC & Voice Activity Detection',
    desc: 'Discrete Cosine Transform of log-mel energies yields 13 cepstral coefficients. Energy-based VAD (top_db 35) isolates active speech segments.',
  },
]

export default function AudioLab() {
  const rootRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(rootRef, [])
  const toast = useToast()
  const [audio, setAudio] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<AudioAnalysis | null>(null)
  const [openConcept, setOpenConcept] = useState<number | null>(0)

  const run = async () => {
    if (!audio) return
    setBusy(true)
    setError(null)
    setRes(null)
    try {
      const out = await api.analyzeAudio(audio)
      setRes(out)
      toast.success('Signal analysis complete', `${out.duration.toFixed(1)}s · ${out.num_frames} frames`)
    } catch (e) {
      const msg = errorMessage(e)
      setError(msg)
      toast.error('Signal analysis failed', msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={rootRef}>
      <PageHeader
        eyebrow="Digital Signal Processing"
        icon={<Waves className="h-5 w-5" />}
        title="Audio Lab"
        subtitle="Acoustic preprocessing pipeline: sampling, framing, windowing, STFT, mel filterbank and MFCC"
      />

      <div className="gsap-reveal grid gap-6 lg:grid-cols-[370px_1fr]">
        <div className="space-y-4">
          <GlassPanel title="Signal input" subtitle="Upload or record audio to inspect DSP features">
            <AudioInput onChange={setAudio} compact />
            <Button
              className="mt-4 w-full"
              disabled={!audio}
              loading={busy}
              onClick={run}
              icon={<Waves className="h-4 w-4" />}
            >
              Analyse signal
            </Button>
            {busy && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-[#e87528]/30 bg-[#e87528]/[0.08] px-3.5 py-2.5 text-xs text-[#fce0c4]">
                <AudioActivityBars active />
                <span>Computing STFT, Mel & MFCC…</span>
              </div>
            )}
          </GlassPanel>

          <GlassPanel title="DSP Configuration" subtitle="Parameters used for feature extraction">
            <dl className="grid grid-cols-2 gap-2.5 text-xs">
              {[
                ['Sampling Rate', res ? `${res.sample_rate.toLocaleString()} Hz` : '16,000 Hz'],
                ['Frame Length', res ? `${res.frame_length_ms} ms` : '25 ms'],
                ['Frame Shift', res ? `${res.hop_length_ms} ms` : '10 ms'],
                ['FFT Size', res ? `${res.n_fft}` : '512'],
                ['Window', res ? res.window : 'Hamming'],
                ['Mel Filters', '64'],
                ['MFCC Coeffs', '13'],
                ['VAD Threshold', '35 dB'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2">
                  <dt className="text-[10px] text-[#82776f]">{k}</dt>
                  <dd className="mt-0.5 font-mono text-[#f7f3ee] capitalize">{v}</dd>
                </div>
              ))}
            </dl>
          </GlassPanel>

          <GlassPanel title="Signal concepts" subtitle="Expandable DSP reference">
            <div className="space-y-2">
              {CONCEPTS.map((c, idx) => {
                const open = openConcept === idx
                return (
                  <div
                    key={c.title}
                    className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenConcept(open ? null : idx)}
                      className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-[#f7f3ee] transition hover:bg-white/[0.03]"
                    >
                      <span>{c.title}</span>
                      <ChevronDown
                        className={cx(
                          'h-3.5 w-3.5 text-[#82776f] transition-transform duration-150',
                          open && 'rotate-180 text-[#ff963f]',
                        )}
                      />
                    </button>
                    {open && (
                      <div className="border-t border-white/[0.06] px-3.5 py-2.5 text-xs leading-relaxed text-[#b9aea4]">
                        {c.desc}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </GlassPanel>
        </div>

        <div className="space-y-4">
          <ErrorBanner message={error} onClose={() => setError(null)} />
          {res ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {res.original_audio_url && (
                  <GlassPanel title="Original signal">
                    <audio src={res.original_audio_url} controls className="h-9 w-full" />
                  </GlassPanel>
                )}
                {res.audio_url && (
                  <GlassPanel title="Noise-reduced signal">
                    <audio src={res.audio_url} controls className="h-9 w-full" />
                  </GlassPanel>
                )}
              </div>
              <AudioAnalysisPanel a={res} />
            </>
          ) : (
            <GlassPanel>
              <Empty icon={<Waves className="h-5 w-5" />} title="No signal analysed yet">
                Upload or record an audio sample on the left to inspect its original and denoised waveforms, STFT spectrogram, Mel spectrogram and MFCC heatmap.
              </Empty>
            </GlassPanel>
          )}
        </div>
      </div>
    </div>
  )
}
