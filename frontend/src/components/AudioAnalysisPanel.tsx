import { Activity } from 'lucide-react'
import type { AudioAnalysis } from '../types'
import { EXPLANATIONS } from '../data/explanations'
import { ProcessingExplanation } from './ProcessingExplanation'
import { GlassPanel, Metric } from './ui'
import { EnvelopeChart, Heatmap } from './Heatmap'

/** The speech-processing panel: waveforms, spectrogram, mel, MFCC, VAD, signal facts. */
export function AudioAnalysisPanel({ a }: { a: AudioAnalysis }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Duration" value={`${a.duration.toFixed(2)} s`} />
        <Metric
          label="Sampling rate"
          value={`${a.sample_rate.toLocaleString()} Hz`}
          hint={a.original_sample_rate ? `original ${a.original_sample_rate.toLocaleString()} Hz` : undefined}
        />
        <Metric label="Channels" value={a.channels ?? '—'} hint="mixed to mono" />
        <Metric
          label="Frames"
          value={a.num_frames}
          hint={`${a.frame_length_ms} ms / ${a.hop_length_ms} ms hop`}
        />
        <Metric
          label="Speech ratio"
          value={`${Math.round(a.speech_ratio * 100)}%`}
          hint={`${a.vad_segments.length} VAD segments`}
        />
        <Metric label="Spectral centroid" value={`${Math.round(a.spectral_centroid_mean_hz)} Hz`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassPanel
          title="Original waveform"
          subtitle="Resampled to 16 kHz mono, peak-normalised. Green regions indicate voice activity (VAD)"
        >
          <EnvelopeChart
            data={a.waveform_original}
            color="#82776f"
            vad={a.vad_segments}
            duration={a.duration}
          />
          <ProcessingExplanation
            className="mt-3.5"
            entries={[EXPLANATIONS.audiolab.decoding, EXPLANATIONS.audiolab.vad]}
          />
        </GlassPanel>

        <GlassPanel
          title="Noise-reduced waveform"
          subtitle={`Spectral gating · ≈${a.estimated_noise_removed_db} dB signal-to-removed-noise`}
        >
          <EnvelopeChart
            data={a.waveform_denoised}
            color="#ffb45c"
            vad={a.vad_segments}
            duration={a.duration}
          />
          <ProcessingExplanation
            className="mt-3.5"
            entries={EXPLANATIONS.audiolab.noise_reduction}
          />
        </GlassPanel>

        <GlassPanel
          title="Spectrogram (STFT)"
          subtitle={`${a.window} window · N_FFT ${a.n_fft} · 0–4 kHz`}
        >
          <Heatmap data={a.spectrogram} yLabel="frequency →" />
          <ProcessingExplanation
            className="mt-3.5"
            entries={EXPLANATIONS.audiolab.spectrogram}
          />
        </GlassPanel>

        <GlassPanel title="Mel spectrogram" subtitle="64 mel filter banks (log power)">
          <Heatmap data={a.mel_spectrogram} yLabel="mel bands →" />
          <ProcessingExplanation
            className="mt-3.5"
            entries={EXPLANATIONS.audiolab.mel_spectrogram}
          />
        </GlassPanel>

        <GlassPanel
          title="MFCC heatmap"
          subtitle="13 Mel-frequency cepstral coefficients per frame, mean-variance normalised"
          className="lg:col-span-2"
        >
          <Heatmap data={a.mfcc} height={116} yLabel="coefficient →" />
          <ProcessingExplanation
            className="mt-3.5"
            entries={EXPLANATIONS.audiolab.mfcc}
          />
        </GlassPanel>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Metric label="RMS energy (mean)" value={a.rms_mean.toFixed(4)} />
        <Metric label="Zero-crossing rate" value={a.zcr_mean.toFixed(4)} />
        <Metric label="Window function" value={a.window} />
        <Metric label="Source format" value={a.format ?? '—'} />
      </div>

      <p className="flex items-center gap-2 text-[11px] text-[#82776f]">
        <Activity className="h-3.5 w-3.5 text-[#ff963f]" />
        Pipeline: decode → resample (16 kHz) → normalise → noise reduction → framing (25 ms) → Hamming window → FFT → mel filterbank → log → DCT (MFCC).
      </p>
    </div>
  )
}
