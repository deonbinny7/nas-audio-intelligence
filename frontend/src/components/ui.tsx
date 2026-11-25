import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2, X } from 'lucide-react'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function AudioActivityBars({ active = true }: { active?: boolean }) {
  const heights = [0.45, 0.85, 0.6, 1, 0.7, 0.9, 0.5]
  return (
    <span className="inline-flex h-4 items-center gap-[3px]" aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className={cx(
            'w-[2.5px] rounded-full bg-gradient-to-t from-[#c85a1b] via-[#e87528] to-[#ffb45c]',
            active && 'animate-wave-bar',
          )}
          style={{
            height: `${Math.round(h * 14)}px`,
            animationDelay: active ? `${i * 0.11}s` : undefined,
          }}
        />
      ))}
    </span>
  )
}

interface GlassPanelProps {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  level?: 1 | 2 | 3
  hover?: boolean
}

export function GlassPanel({
  children,
  className,
  title,
  subtitle,
  action,
  level = 1,
  hover = false,
}: GlassPanelProps) {
  const surface =
    level === 3
      ? 'glass-panel-elevated'
      : level === 2
        ? 'glass-panel-2'
        : 'glass-panel'

  return (
    <section
      className={cx(
        surface,
        'p-5 sm:p-6',
        hover && 'glass-hover',
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold tracking-tight text-[#f7f3ee]">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-[#b9aea4]">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export const Card = GlassPanel

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}) {
  const styles: Record<Variant, string> = {
    primary:
      'bg-gradient-to-br from-[#ff963f] via-[#e87528] to-[#c85a1b] text-[#080808] font-semibold shadow-[0_8px_24px_-4px_rgba(232,117,40,0.45)] hover:brightness-110 active:scale-[0.985]',
    secondary:
      'border border-[#ff963f]/25 bg-white/[0.06] text-[#f7f3ee] backdrop-blur-md hover:border-[#ff963f]/45 hover:bg-white/[0.1] active:scale-[0.985]',
    ghost:
      'text-[#b9aea4] hover:bg-white/[0.06] hover:text-[#ff963f] active:scale-[0.985]',
    danger:
      'border border-[#f47769]/35 bg-[#f47769]/10 text-[#f9aba2] hover:bg-[#f47769]/20 hover:border-[#f47769]/55 active:scale-[0.985]',
  }
  const sizes: Record<Size, string> = {
    sm: 'rounded-xl px-3 py-1.5 text-xs',
    md: 'rounded-xl px-4 py-2.5 text-[13px]',
    lg: 'rounded-[14px] px-5 py-3 text-sm',
  }

  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex cursor-pointer items-center justify-center gap-2 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff963f]/55 disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100',
        sizes[size],
        styles[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
}

export function Badge({
  children,
  color,
  className,
}: {
  children: ReactNode
  color?: string
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-[#b9aea4]',
        className,
      )}
      style={
        color
          ? {
              color,
              borderColor: color + '44',
              background: color + '16',
            }
          : undefined
      }
    >
      {children}
    </span>
  )
}

export function StatusDot({ ok, label, muted }: { ok: boolean; label: string; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-[#b9aea4]">
      <span
        className={cx(
          'h-2 w-2 shrink-0 rounded-full',
          ok
            ? 'bg-[#43c995] shadow-[0_0_10px_rgba(67,201,149,0.65)]'
            : muted
              ? 'bg-[#5f5852]'
              : 'bg-[#f0b65e] shadow-[0_0_8px_rgba(240,182,94,0.45)]',
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  )
}

export const StatusIndicator = StatusDot

export function ErrorBanner({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-[#f47769]/35 bg-[#f47769]/10 px-4 py-3 text-[13px] text-[#fbd2cd] backdrop-blur-md"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#f47769]" />
      <div className="min-w-0 flex-1 break-words leading-relaxed">{message}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-[#f9aba2] transition hover:bg-white/10 hover:text-white"
          aria-label="Close error"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div
      className={cx(
        'rounded-2xl border px-4 py-3 text-xs leading-relaxed backdrop-blur-md',
        tone === 'warn'
          ? 'border-[#f0b65e]/30 bg-[#f0b65e]/[0.08] text-[#fae0b8]'
          : 'border-[#e87528]/25 bg-[#e87528]/[0.07] text-[#fce0c4]',
      )}
    >
      {children}
    </div>
  )
}

export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#e87528]/25 bg-white/[0.02] px-6 py-12 text-center">
      <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e87528]/25 bg-[#e87528]/10 text-[#ff963f]">
        {icon}
      </div>
      <p className="text-sm font-semibold text-[#f7f3ee]">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-xs leading-relaxed text-[#b9aea4]">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export const EmptyState = Empty

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: ReactNode; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  const uid = useId()
  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.04] p-1 backdrop-blur-xl">
      {tabs.map(t => {
        const active = value === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cx(
              'relative flex shrink-0 cursor-pointer items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
              active ? 'text-[#f7f3ee]' : 'text-[#82776f] hover:text-[#b9aea4]',
            )}
          >
            {active && (
              <motion.span
                layoutId={`tab-pill-${uid}`}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className="absolute inset-0 rounded-xl border border-[#ff963f]/40 bg-[#e87528]/18 shadow-[0_0_16px_rgba(232,117,40,0.18)]"
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span className={active ? 'text-[#ff963f]' : 'text-[#82776f]'}>{t.icon}</span>
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cx(
                    'rounded-md px-1.5 py-0.2 font-mono text-[10px]',
                    active ? 'bg-[#ff963f]/20 text-[#fce0c4]' : 'bg-white/[0.07] text-[#b9aea4]',
                  )}
                >
                  {t.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cx('input cursor-pointer appearance-none', className)}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[#14110f] text-[#f7f3ee]">
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Progress({ value, label, sub }: { value: number; label?: string; sub?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div>
      {(label || sub) && (
        <div className="mb-2 flex justify-between text-xs">
          <span className="font-medium text-[#f7f3ee]">{label}</span>
          <span className="font-mono text-[#ffb45c]">{sub}</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c85a1b] via-[#e87528] to-[#ffb45c] shadow-[0_0_12px_rgba(232,117,40,0.6)] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function PageHeader({
  icon,
  title,
  subtitle,
  eyebrow,
  action,
}: {
  icon: ReactNode
  title: string
  subtitle: string
  eyebrow?: string
  action?: ReactNode
}) {
  return (
    <div className="gsap-reveal mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-4">
        <div className="glass-logo-frame flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-[#ff963f]">
          {icon}
        </div>
        <div>
          {eyebrow && <div className="label mb-1 text-[#ff963f]">{eyebrow}</div>}
          <h1 className="text-[28px] font-semibold tracking-tight text-[#f7f3ee] sm:text-[32px] leading-tight">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[#b9aea4]">{subtitle}</p>
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="glass-panel rounded-2xl px-4 py-3">
      <div className="label">{label}</div>
      <div className="mt-1.5 font-mono text-sm font-semibold text-[#f7f3ee]">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-[#82776f]">{hint}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-xl bg-white/[0.06]', className)} />
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCancel}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="glass-panel-elevated relative z-10 w-full max-w-md p-6"
          >
            <h3 className="text-base font-semibold text-[#f7f3ee]">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#b9aea4]">{description}</p>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant={danger ? 'danger' : 'primary'}
                size="sm"
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
