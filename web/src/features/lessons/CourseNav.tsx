import { useId, useState } from 'react'
import { Link, NavLink } from 'react-router'
import { format, t } from '../../i18n/index.ts'
import type { CourseOutline } from '../../shared/api/generated/model'

type Props = {
  course: CourseOutline
  currentSlug: string
}

/** Left column of a lesson: exit button and the course contents. Collapses into a toggle below 768px. */
export function CourseNav({ course, currentSlug }: Props) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const lessons = course.groups.flatMap((g) => g.lessons)
  const current = lessons.find((l) => l.slug === currentSlug)

  return (
    <nav
      aria-label={t.lessons.courseNav}
      className="flex flex-wrap items-center gap-2.5 border-b-[1.5px] border-ink px-4 py-3 md:max-w-[280px] md:flex-[1_1_240px] md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:border-r-[1.5px] md:border-b-0 md:pt-8 md:pr-6 md:pb-10 md:pl-10"
    >
      <Link
        to="/lessons"
        className="flex h-11 flex-[1_1_140px] items-center border-[1.5px] border-ink px-3 font-display text-sm whitespace-nowrap md:px-3.5 md:text-[15px] tracking-[0.06em] uppercase no-underline md:flex-none"
      >
        {t.lessons.allLessons}
      </Link>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 flex-[1_1_140px] cursor-pointer items-center justify-between gap-2 border-[1.5px] border-ink bg-paper px-3 font-display text-sm tracking-[0.06em] whitespace-nowrap text-ink uppercase md:hidden"
      >
        {format(t.lessons.contentsToggle, { number: current?.number ?? '–', total: lessons.length })}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      <div id={listId} className={`${open ? 'flex' : 'hidden'} w-full flex-col gap-6 md:flex`}>
        {course.groups.map((group) => (
          <div key={group.id}>
            <div className="mb-1.5 border-b-[1.5px] border-ink pb-2 font-display text-sm tracking-[0.08em] text-muted uppercase">
              {group.title}
            </div>
            {group.lessons.map((lesson) => (
              <NavLink
                key={lesson.slug}
                to={`/lessons/${lesson.slug}`}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-baseline gap-2.5 py-2 text-base no-underline ${
                    isActive ? '-mx-2.5 bg-ink px-2.5 font-semibold text-paper hover:text-paper' : ''
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`w-5 font-display ${isActive ? '' : 'text-muted'}`}>{lesson.number}</span>
                    <span lang="pl">{lesson.title}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
