import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
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
  // Polled only while the API is down, so the notice disappears once the server is back.
  const api = useGetVersion({
    query: { refetchInterval: (query) => (query.state.status === 'error' ? 5_000 : false) },
  })

  // When the server comes back, reload whatever failed while it was down.
  const queryClient = useQueryClient()
  const wasDown = useRef(false)
  useEffect(() => {
    if (api.isError) wasDown.current = true
    else if (api.isSuccess && wasDown.current) {
      wasDown.current = false
      void queryClient.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' })
    }
  }, [api.isError, api.isSuccess, queryClient])

  return (
    <div className="flex min-h-screen flex-col">
      <header data-print="hide" className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-ink px-4 py-2 md:px-10">
        <div className="flex items-center gap-2.5 font-display text-3xl leading-none font-bold tracking-tight uppercase">
          Mów po polsku!
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

      {api.isError && (
        <div
          role="alert"
          data-print="hide"
          className="sticky bottom-0 border-t-2 border-ink bg-vermilion-dark px-4 py-3 text-[15px] text-paper md:px-10"
        >
          {t.apiStatus.unavailable}
        </div>
      )}
    </div>
  )
}
