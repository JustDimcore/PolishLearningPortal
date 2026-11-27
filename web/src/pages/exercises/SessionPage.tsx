import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { ExerciseCard } from '../../features/exercises/ExerciseCard.tsx'
import { firstOpen } from '../../features/exercises/exercise.ts'
import { Progress } from '../../features/exercises/Progress.tsx'
import { SessionNav } from '../../features/exercises/SessionNav.tsx'
import { SessionSummary } from '../../features/exercises/SessionSummary.tsx'
import { sessionQueryKey, usePracticeSession } from '../../features/exercises/usePracticeSession.ts'
import { format, t } from '../../i18n/index.ts'
import { ApiError } from '../../shared/api/fetcher.ts'
import { useGetCourse } from '../../shared/api/generated/lessons/lessons.ts'
import { discardSession } from '../../shared/storage/db.ts'
import { PlaceholderPage } from '../PlaceholderPage.tsx'

export const REPEAT_KEY = 'repeat'

/**
 * A practice session: /exercises/:lesson for a lesson, /exercises/repeat?ids=… for chosen exercises.
 * The session is kept in the browser, so leaving and coming back resumes it.
 */
export function SessionPage() {
  const { lesson } = useParams()
  const [search] = useSearchParams()
  const key = lesson ? `lesson:${lesson}` : REPEAT_KEY
  const session = usePracticeSession(key, lesson ? { lesson } : { ids: search.get('ids') ?? '' })
  const course = useGetCourse()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // null: follow the first unanswered exercise; a number: an exercise the learner reopened from the list.
  const [selected, setSelected] = useState<number | null>(null)
  // A session finished in an earlier visit opens on its summary; one finished just now first shows the last verdict.
  const [showSummary, setShowSummary] = useState(false)
  const [answeredHere, setAnsweredHere] = useState(false)

  if (session.error instanceof ApiError && session.error.status < 500) {
    return <PlaceholderPage title={t.session.notFound} note="" />
  }
  if (session.isPending || !session.data) {
    return (
      <p role={session.isError ? 'alert' : undefined} className={`px-4 py-10 md:px-10 ${session.isError ? 'text-vermilion-dark' : 'text-muted'}`}>
        {session.isError ? t.session.startError : t.exercises.loading}
      </p>
    )
  }

  const data = session.data
  const lessons = course.data?.groups.flatMap((g) => g.lessons) ?? []
  const lessonIndex = lessons.findIndex((l) => l.slug === data.lesson)
  const lessonTitle = lessonIndex >= 0 ? lessons[lessonIndex].title : undefined

  if (data.finishedAt && selected === null && (showSummary || !answeredHere)) {
    return (
      <SessionSummary
        session={data}
        lessonTitle={lessonTitle}
        nextLesson={lessonIndex >= 0 ? (lessons[lessonIndex + 1] ?? null) : undefined}
        onRestart={() => {
          setShowSummary(false)
          setAnsweredHere(false)
          void session.restart()
        }}
        onRepeat={(ids) => {
          void (async () => {
            await discardSession(REPEAT_KEY)
            await queryClient.resetQueries({ queryKey: sessionQueryKey(REPEAT_KEY) })
            void navigate(`/exercises/repeat?ids=${ids.join(',')}`)
          })()
        }}
      />
    )
  }

  const open = firstOpen(data)
  const current = selected ?? (open === -1 ? data.exercises.length - 1 : open)
  const exercise = data.exercises[current]

  function next() {
    setSelected(null)
    const remaining = firstOpen(data)
    if (remaining === -1) setShowSummary(true)
  }

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col md:flex-row">
      <SessionNav session={data} current={current} onSelect={(i) => setSelected(i === firstOpen(data) ? null : i)} />
      <main className="min-w-0 md:flex-[999_1_640px]">
        <div className="mx-auto flex max-w-[880px] flex-col gap-6 px-4 pt-8 pb-18 md:px-10">
          <div className="flex flex-col gap-3">
            <div className="kicker">
              {lessonTitle
                ? format(t.session.kicker, { lesson: lessonTitle, number: current + 1, total: data.exercises.length })
                : format(t.session.kickerRepeat, { number: current + 1, total: data.exercises.length })}
            </div>
            <Progress session={data} />
          </div>
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            result={data.results[exercise.id]}
            onSubmit={async (answers) => {
              // Stay on this exercise to show the verdict; "Next" moves on.
              setSelected(current)
              await session.answer(exercise, answers)
              setAnsweredHere(true)
            }}
            onNext={next}
            isLast={open === -1}
          />
        </div>
      </main>
    </div>
  )
}
