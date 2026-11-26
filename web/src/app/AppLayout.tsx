import { NavLink, Outlet, ScrollRestoration } from 'react-router'
import { t } from '../i18n/index.ts'
import { useGetVersion } from '../shared/api/generated/app-info/app-info.ts'

const sections = [
  { to: '/lessons', label: t.nav.lessons },
  { to: '/exercises', label: t.nav.exercises },
  { to: '/cheatsheet', label: t.nav.cheatsheet },
  { to: '/mistakes', label: t.nav.mistakes },
]

export function AppLayout() {
  const version = useGetVersion()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink px-4 py-2 md:px-10">
        <div className="flex items-center gap-2.5 font-display text-3xl leading-none font-bold tracking-tight uppercase">
          Mów po polsku!
          <span className="-rotate-3 bg-vermilion-dark px-1.5 py-0.5 text-xs tracking-wider text-paper">{t.app.badge}</span>
        </div>
        <nav aria-label={t.nav.label} className="flex flex-wrap gap-x-5 font-display text-base tracking-wide uppercase md:gap-x-7">
          {sections.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              className={({ isActive }) =>
                `inline-block border-b-2 pt-3 pb-2.5 no-underline ${isActive ? 'border-vermilion' : 'border-transparent'}`
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>
      <ScrollRestoration />

      <footer className="border-t border-hairline px-4 py-3 text-sm text-muted md:px-10">
        {t.apiStatus.label}{' '}
        {version.isPending && t.apiStatus.connecting}
        {version.isError && <span className="text-vermilion-dark">{t.apiStatus.unavailable}</span>}
        {version.data && `${version.data.name} · ${version.data.version}`}
      </footer>
    </div>
  )
}
