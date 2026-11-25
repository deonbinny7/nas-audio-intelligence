import { useEffect, useRef, useState } from 'react'
import { Cpu, KeyRound, Save, Settings as SettingsIcon, Trash2 } from 'lucide-react'
import { useToast } from '../components/Toast'
import { ProcessingExplanation } from '../components/ProcessingExplanation'
import { Button, ConfirmModal, ErrorBanner, GlassPanel, Notice, PageHeader, Select, StatusDot } from '../components/ui'
import { EXPLANATIONS } from '../data/explanations'
import { useAsync } from '../hooks/useAsync'
import { useStaggerReveal } from '../hooks/useGsapEntrance'
import { api, errorMessage } from '../services/api'

export default function SettingsPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  useStaggerReveal(rootRef, [])
  const toast = useToast()
  const s = useAsync(() => api.settings(), [])
  const health = useAsync(() => api.health(), [])
  const [gemini, setGemini] = useState('')
  const [hf, setHf] = useState('')
  const [whisper, setWhisper] = useState('small')
  const [diar, setDiar] = useState('auto')
  const [model, setModel] = useState('')
  const [nr, setNr] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unloading, setUnloading] = useState(false)
  const [confirmUnload, setConfirmUnload] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (s.data) {
      setWhisper(s.data.whisper_model)
      setDiar(s.data.diarization_backend)
      setModel(s.data.gemini_model)
      setNr(s.data.noise_reduction)
    }
  }, [s.data])

  const save = async () => {
    setSaving(true)
    setError(null)
    setMsg(null)
    try {
      const body: Record<string, unknown> = {
        whisper_model: whisper,
        diarization_backend: diar,
        gemini_model: model,
        noise_reduction: nr,
      }
      if (gemini.trim()) body.gemini_api_key = gemini.trim()
      if (hf.trim()) body.hf_token = hf.trim()
      s.setData(await api.saveSettings(body))
      setGemini('')
      setHf('')
      setMsg('Saved to backend/.env. Models reload on next use.')
      toast.success('Settings saved', 'Configuration updated in backend/.env')
      health.reload()
    } catch (e) {
      const m = errorMessage(e)
      setError(m)
      toast.error('Failed to save settings', m)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={rootRef}>
      <PageHeader
        eyebrow="System Configuration"
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        subtitle="API credentials, AI models and audio pipeline configuration (stored locally in backend/.env)"
      />

      <div className="gsap-reveal grid gap-6 lg:grid-cols-2">
        <GlassPanel
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#ff963f]" /> API Configuration
            </span>
          }
          subtitle="Secrets are never returned in plain text; only masked previews are displayed"
        >
          <div className="space-y-4">
            <div>
              <div className="label mb-1.5">Gemini API key(s)</div>
              <input
                className="input font-mono"
                type="password"
                placeholder={
                  s.data?.gemini_key_set
                    ? `Configured: ${s.data.gemini_api_key}`
                    : 'Paste key — comma-separate multiple keys for automatic fallback'
                }
                value={gemini}
                onChange={e => setGemini(e.target.value)}
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-[#82776f]">
                Powers translation and meeting intelligence. Multiple comma-separated keys rotate automatically on quota limits.
              </p>
            </div>

            <div>
              <div className="label mb-1.5">Hugging Face token (optional)</div>
              <input
                className="input font-mono"
                type="password"
                placeholder={
                  s.data?.hf_token_set
                    ? `Configured: ${s.data.hf_token}`
                    : 'Only required for pyannote speaker diarization'
                }
                value={hf}
                onChange={e => setHf(e.target.value)}
              />
            </div>

            <div>
              <div className="label mb-1.5">Gemini model</div>
              <input
                className="input font-mono"
                value={model}
                onChange={e => setModel(e.target.value)}
              />
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title={
            <span className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#ff963f]" /> Models & Audio
            </span>
          }
          subtitle="Local inference models and acoustic preprocessing"
        >
          <div className="space-y-4">
            <div>
              <div className="label mb-1.5">Whisper model (CPU int8)</div>
              <Select
                value={whisper}
                onChange={setWhisper}
                options={[
                  { value: 'tiny', label: 'tiny · fastest, lowest accuracy (~75 MB)' },
                  { value: 'base', label: 'base · fast (~145 MB)' },
                  { value: 'small', label: 'small · recommended for multilingual (~480 MB)' },
                  { value: 'medium', label: 'medium · highest accuracy, ~2.5 GB RAM' },
                ]}
              />
            </div>

            <div>
              <div className="label mb-1.5">Diarization backend</div>
              <Select
                value={diar}
                onChange={setDiar}
                options={[
                  { value: 'auto', label: 'Auto (pyannote if token + installed, else SpeechBrain)' },
                  { value: 'speechbrain', label: 'SpeechBrain ECAPA-TDNN + clustering' },
                  { value: 'pyannote', label: 'pyannote speaker-diarization-3.1' },
                ]}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 pt-1 text-sm text-[#b9aea4]">
              <input
                type="checkbox"
                checked={nr}
                onChange={e => setNr(e.target.checked)}
                className="accent-[#e87528]"
              />
              Enable spectral-gating noise reduction before ASR
            </label>

            <div className="flex flex-wrap gap-2.5 pt-2">
              <Button loading={saving} onClick={save} icon={<Save className="h-4 w-4" />}>
                Save settings
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmUnload(true)}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Free memory
              </Button>
            </div>

            <ErrorBanner message={error} onClose={() => setError(null)} />
            {msg && <Notice>{msg}</Notice>}
          </div>
        </GlassPanel>

        {health.data && (
          <GlassPanel title="System health" subtitle="Live backend component availability" className="lg:col-span-2">
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <StatusDot
                ok={health.data.ffmpeg}
                label={health.data.ffmpeg ? 'FFmpeg available' : 'FFmpeg missing'}
              />
              <StatusDot
                ok={health.data.whisper.loaded}
                muted={!health.data.whisper.loaded}
                label={`Whisper ${health.data.whisper.model} (${health.data.whisper.loaded ? 'loaded in RAM' : 'loads on first use'})`}
              />
              <StatusDot
                ok={health.data.diarization.encoder_loaded}
                muted={!health.data.diarization.encoder_loaded}
                label={`ECAPA encoder (${health.data.diarization.encoder_loaded ? 'loaded in RAM' : 'loads on first use'})`}
              />
              <StatusDot
                ok={health.data.diarization.pyannote_installed}
                muted={!health.data.diarization.pyannote_installed}
                label={health.data.diarization.pyannote_installed ? 'pyannote installed' : 'pyannote not installed (optional)'}
              />
            </div>
            {health.data.diarization.last_error && (
              <div className="mt-4">
                <Notice tone="warn">pyannote error: {health.data.diarization.last_error}</Notice>
              </div>
            )}
          </GlassPanel>
        )}

        {s.data && (
          <div className="lg:col-span-2">
            <ProcessingExplanation entries={EXPLANATIONS.settings.configuration} />
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmUnload}
        title="Unload AI models from memory?"
        description="This will release Whisper and ECAPA-TDNN weights from RAM. They will reload automatically the next time you run transcription or speaker analysis."
        confirmLabel="Unload models"
        loading={unloading}
        onCancel={() => setConfirmUnload(false)}
        onConfirm={async () => {
          setUnloading(true)
          try {
            await api.unload()
            setMsg('Models unloaded from RAM.')
            toast.info('Memory freed', 'Whisper and ECAPA-TDNN unloaded from RAM')
            health.reload()
          } finally {
            setUnloading(false)
            setConfirmUnload(false)
          }
        }}
      />
    </div>
  )
}
