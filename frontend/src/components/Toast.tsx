import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  type: ToastType
  title: string
  description?: string
}

interface ToastContextValue {
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((type: ToastType, title: string, description?: string) => {
    const id = Date.now() + Math.random()
    setItems(prev => [...prev.slice(-3), { id, type, title, description }])
    setTimeout(() => {
      setItems(prev => prev.filter(x => x.id !== id))
    }, 4200)
  }, [])

  const success = useCallback((t: string, d?: string) => push('success', t, d), [push])
  const error = useCallback((t: string, d?: string) => push('error', t, d), [push])
  const info = useCallback((t: string, d?: string) => push('info', t, d), [push])

  const value = useMemo<ToastContextValue>(() => ({ success, error, info }), [success, error, info])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2.5 sm:right-6 sm:bottom-6"
      >
        <AnimatePresence initial={false}>
          {items.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel-elevated pointer-events-auto flex items-start gap-3 p-3.5"
            >
              <div className="mt-0.5 shrink-0">
                {t.type === 'success' && <CheckCircle2 className="h-4 w-4 text-[#43c995]" />}
                {t.type === 'error' && <AlertTriangle className="h-4 w-4 text-[#f47769]" />}
                {t.type === 'info' && <Info className="h-4 w-4 text-[#ff963f]" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#f7f3ee]">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-[#b9aea4]">{t.description}</p>}
              </div>
              <button
                onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}
                className="rounded-lg p-1 text-[#82776f] transition hover:bg-white/10 hover:text-[#f7f3ee]"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      success: () => {},
      error: () => {},
      info: () => {},
    }
  }
  return ctx
}
