import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  History,
  Languages,
  LayoutDashboard,
  Menu,
  Presentation,
  Settings,
  Users,
  Waves,
  X,
} from 'lucide-react'
import { cx } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/linguavoice', label: 'LinguaVoice', icon: Languages },
  { to: '/voiceid', label: 'VoiceID', icon: Users },
  { to: '/meetinglens', label: 'MeetingLens', icon: Presentation },
  { to: '/audio-lab', label: 'Audio Lab', icon: Waves },
  { to: '/history', label: 'History', icon: History },
]

export function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <div className="glass-logo-frame flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-1.5 transition-transform duration-200 group-hover:scale-[1.04]">
        <img
          src="/nas-icon.png"
          alt="NAS"
          className="h-full w-full object-contain"
        />
      </div>
      <span className="text-[18px] font-semibold tracking-tight text-[#f7f3ee]">NAS</span>
    </Link>
  )
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex min-h-full flex-col text-[#f7f3ee]">
      {/* Floating Horizontal Glass Navbar */}
      <div className="sticky top-3 z-40 mx-auto w-full max-w-[1320px] px-4 sm:px-6 md:px-10">
        <header className="glass-panel-elevated flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
          {/* Left: Official NAS Logo */}
          <Logo />

          {/* Center: Horizontal Navigation */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cx(
                    'group relative flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                    isActive
                      ? 'text-[#ff963f]'
                      : 'text-[#b9aea4] hover:bg-white/[0.045] hover:text-[#f7f3ee]',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="top-nav-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-xl border border-[#ff963f]/40 bg-[#e87528]/[0.14] shadow-[0_0_18px_rgba(232,117,40,0.16)]"
                      />
                    )}
                    <n.icon
                      className={cx(
                        'relative z-10 h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-[#ff963f]' : 'text-[#82776f] group-hover:text-[#ffb45c]',
                      )}
                    />
                    <span className="relative z-10 hidden whitespace-nowrap lg:inline">{n.label}</span>
                    <span className="relative z-10 whitespace-nowrap md:inline lg:hidden">{n.label.split(' ')[0]}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right: Settings + Mobile Menu */}
          <div className="flex items-center gap-2">
            <NavLink
              to="/settings"
              aria-label="Settings"
              title="Settings"
              className={({ isActive }) =>
                cx(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-150',
                  isActive
                    ? 'border-[#ff963f]/45 bg-[#e87528]/18 text-[#ff963f] shadow-[0_0_14px_rgba(232,117,40,0.2)]'
                    : 'border-white/[0.09] bg-white/[0.04] text-[#b9aea4] hover:border-[#ff963f]/40 hover:bg-white/[0.08] hover:text-[#ff963f]',
                )
              }
            >
              <Settings className="h-4 w-4" />
            </NavLink>

            <button
              type="button"
              onClick={() => setMobileOpen(v => !v)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-[#f7f3ee] transition hover:border-[#ff963f]/40 md:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Glass Dropdown Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="glass-panel-elevated mt-2 p-3 md:hidden"
            >
              <nav className="grid grid-cols-2 gap-1.5">
                {[...NAV, { to: '/settings', label: 'Settings', icon: Settings, end: false }].map(n => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cx(
                        'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
                        isActive
                          ? 'border border-[#ff963f]/40 bg-[#e87528]/18 text-[#ff963f]'
                          : 'text-[#b9aea4] hover:bg-white/[0.05] hover:text-[#f7f3ee]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <n.icon className={cx('h-4 w-4', isActive ? 'text-[#ff963f]' : 'text-[#82776f]')} />
                        <span>{n.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content Workspace */}
      <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 pt-7 pb-12 sm:px-6 md:px-10 md:pt-9">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
