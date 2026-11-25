import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Info } from 'lucide-react'
import type { ExplanationEntry } from '../data/explanations'
import { cx } from './ui'

interface ProcessingExplanationProps {
  entries: ExplanationEntry | readonly ExplanationEntry[]
  heading?: string
  defaultOpen?: boolean
  className?: string
}

/**
 * Compact, collapsible static explainability panel showing how a result was generated.
 * Appears only after a successful processing result is available.
 */
export function ProcessingExplanation({
  entries,
  heading = 'How this result was generated',
  defaultOpen = false,
  className,
}: ProcessingExplanationProps) {
  const [open, setOpen] = useState(defaultOpen)
  const list: readonly ExplanationEntry[] = Array.isArray(entries)
    ? entries
    : [entries as ExplanationEntry]
  if (!list.length) return null

  const primary = list[0]

  return (
    <aside
      className={cx(
        'rounded-2xl border border-[#e87528]/20 bg-white/[0.03] px-4 py-3.5 backdrop-blur-xl transition-colors',
        open && 'border-[#e87528]/32 bg-white/[0.045]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[#e87528]/25 bg-[#e87528]/12 text-[#ff963f]">
            <Info className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[#ffb45c]">
              {heading}
            </div>
            {!open && (
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#b9aea4]">
                {list.length === 1
                  ? primary.description
                  : `${list.map(e => e.title).join(' · ')} — ${primary.description}`}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-[#b9aea4] transition hover:border-[#ff963f]/35 hover:text-[#f7f3ee]"
        >
          <span>{open ? 'Hide details' : 'View processing steps'}</span>
          <ChevronDown
            className={cx(
              'h-3.5 w-3.5 text-[#ff963f] transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3.5 space-y-3 border-t border-white/[0.07] pt-3.5">
              {list.map(item => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/[0.06] bg-[#14110f]/75 p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-[13px] font-semibold text-[#f7f3ee]">{item.title}</h4>
                    {item.model && (
                      <span className="rounded-md border border-[#e87528]/25 bg-[#e87528]/10 px-2 py-0.5 font-mono text-[10px] text-[#ffb45c]">
                        {item.model}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-[#b9aea4]">
                    {item.description}
                  </p>
                  {item.steps && item.steps.length > 0 && (
                    <ol className="mt-2.5 space-y-1 text-xs text-[#f7f3ee]/90">
                      {item.steps.map((step, i) => (
                        <li key={step} className="flex items-start gap-2">
                          <span className="font-mono text-[10px] font-medium text-[#ff963f] mt-0.5">
                            0{i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {item.note && (
                    <p className="mt-2 text-[11px] italic text-[#82776f]">{item.note}</p>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  )
}
