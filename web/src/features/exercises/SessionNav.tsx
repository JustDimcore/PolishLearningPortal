import { useId, useState } from 'react'
import { Link } from 'react-router'
import { format, t } from '../../i18n/index.ts'
import type { PracticeSession } from '../../shared/storage/db.ts'

type Props = {
  session: PracticeSession
  current: number
  onSelect: (index: number) => void
}

/** Left column of a session: exit link and the list of exercises with their results. */
export function SessionNav({ session, current, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const back = session.lesson
    ? { to: `/lessons/${session.lesson}`, label: t.session.backToLesson }
    : { to: '/exercises', label: t.session.backToList }

  return (
    <nav
      aria-label={t.session.navLabel}
      className="flex flex-wrap items-center gap-2.5 border-b-[1.5px] border-ink px-4 py-3 md:max-w-[280px] md:flex-[1_1_240px] md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:border-r-[1.5px] md:border-b-0 md:pt-8 md:pr-6 md:pb-10 md:pl-10"
    >
      <Link
        to={back.to}
        className="flex h-11 flex-[1_1_140px] items-center border-[1.5px] border-ink px-3 font-display text-sm tracking-[0.06em] whitespace-nowrap uppercase no-underline md:flex-none md:px-3.5 md:text-[15px]"
      >
        {back.label}
      </Link>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 flex-[1_1_140px] cursor-pointer items-center justify-between gap-2 border-[1.5px] border-ink bg-paper px-3 font-display text-sm tracking-[0.06em] whitespace-nowrap text-ink uppercase md:hidden"
      >
        {t.session.listToggle}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div id={listId} className={`${open ? 'flex' : 'hidden'} w-full flex-col md:flex`}>
        <div className="mb-1.5 border-b-[1.5px] border-ink pb-2 font-display text-sm tracking-[0.08em] text-muted uppercase">
          {format(t.session.listTitle, { count: session.exercises.length })}
        </div>
        {session.exercises.map((exercise, index) => {
          const result = session.results[exercise.id]
          const isCurrent = index === current
          const content = (
            <>
              <span className={`w-6 font-display ${isCurrent ? '' : 'text-muted'}`}>{index + 1}</span>
              <span className="flex-1">{t.session.type[exercise.type]}</span>
              {result && (
                <>
                  <span aria-hidden="true" className={result.check.verdict === 'correct' ? '' : 'text-vermilion-dark'}>
                    {result.check.verdict === 'correct' ? '✓' : '✕'}
                  </span>
                  <span className="sr-only">
                    {result.check.verdict === 'correct' ? t.session.statusCorrect : t.session.statusWrong}
                  </span>
                </>
              )}
            </>
          )
          const base = 'flex items-baseline gap-2.5 py-2 text-left text-base'
          // Answered exercises can be reopened to read the verdict again; later ones are not reachable yet.
          return result || isCurrent ? (
            <button
              key={exercise.id}
              type="button"
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => {
                onSelect(index)
                setOpen(false)
              }}
              className={`${base} cursor-pointer border-0 font-serif ${
                isCurrent ? '-mx-2.5 bg-ink px-2.5 font-semibold text-paper' : 'bg-transparent text-ink'
              }`}
            >
              {content}
            </button>
          ) : (
            <div key={exercise.id} className={`${base} text-muted`}>
              {content}
            </div>
          )
        })}
      </div>
    </nav>
  )
}
