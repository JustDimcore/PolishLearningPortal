import { Link } from 'react-router'
import { format, t } from '../../i18n/index.ts'
import type { Exercise, LessonLink } from '../../shared/api/generated/model'
import type { ExerciseResult, PracticeSession } from '../../shared/storage/db.ts'
import { Correction, Sentence } from './ExerciseCard.tsx'
import { Progress } from './Progress.tsx'
import { score } from './exercise.ts'

type Props = {
  session: PracticeSession
  lessonTitle: string | undefined
  nextLesson: LessonLink | null | undefined
  onRepeat: (ids: string[]) => void
  onRestart: () => void
}

const primary =
  'inline-flex h-[42px] cursor-pointer items-center border-[1.5px] border-ink bg-ink px-5 font-display text-sm tracking-[0.06em] text-paper uppercase no-underline hover:text-paper'
const quiet =
  'inline-flex h-[42px] cursor-pointer items-center border-0 bg-transparent px-0 font-display text-sm tracking-[0.06em] text-muted uppercase underline underline-offset-4 hover:text-ink'

/** End of a session: score, the mistakes with corrections, and where to go next. */
export function SessionSummary({ session, lessonTitle, nextLesson, onRepeat, onRestart }: Props) {
  const { correct } = score(session)
  const mistakes = session.exercises
    .map((exercise, index) => ({ exercise, index, result: session.results[exercise.id] }))
    .filter((m) => m.result && m.result.check.verdict !== 'correct')
  const minutes = session.finishedAt
    ? Math.max(1, Math.round((Date.parse(session.finishedAt) - Date.parse(session.startedAt)) / 60_000))
    : null

  return (
    <main className="mx-auto flex max-w-[880px] flex-col gap-12 px-4 pt-8 pb-18 md:px-10">
      <header className="flex flex-col gap-4">
        <div className="kicker">{lessonTitle ? `${t.exercises.kicker} · ${lessonTitle}` : t.exercises.kicker}</div>
        <h1 className="m-0 font-display text-4xl leading-tight font-bold tracking-tight uppercase">{t.session.summaryTitle}</h1>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <div className="font-display text-4xl font-bold">
            {correct}
            <span className="text-muted"> / {session.exercises.length}</span>{' '}
            <span className="text-base font-normal tracking-[0.06em] uppercase">{t.session.score}</span>
          </div>
          <div className="text-muted">
            {format(t.session.mistakesCount, { count: mistakes.length })}
            {minutes !== null && ` · ${format(t.session.minutes, { minutes })}`}
          </div>
        </div>
        <Progress session={session} />
      </header>

      <section aria-labelledby="summary-mistakes">
        <h2 id="summary-mistakes" className="mt-0 mb-4 flex items-baseline gap-3 font-display text-xl font-bold uppercase">
          <span className="text-vermilion-dark">01</span>
          {t.session.mistakesTitle}
        </h2>
        {mistakes.length === 0 ? (
          <p className="m-0 text-muted">{t.session.noMistakes}</p>
        ) : (
          <>
            <ul className="m-0 list-none border-t-[1.5px] border-ink p-0">
              {mistakes.map(({ exercise, index, result }) => (
                <li key={exercise.id} className="flex flex-wrap gap-x-6 gap-y-1 border-b border-hairline py-3">
                  <span className="flex-[0_0_120px] font-display text-sm tracking-[0.06em] text-muted uppercase">
                    {format(t.session.taskNumber, { number: index + 1 })}
                  </span>
                  <span className="min-w-0 flex-[1_1_300px]">
                    <Digest exercise={exercise} result={result!} />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 mb-0 text-[15px] text-muted">
              <span aria-hidden="true" className="font-sans">↳ </span>
              {t.session.mistakesNote}
            </p>
          </>
        )}
      </section>

      {/* One main action — repeat the mistakes, or move on when there are none; the rest are quiet links. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        {mistakes.length > 0 ? (
          <button type="button" onClick={() => onRepeat(mistakes.map((m) => m.exercise.id))} className={primary}>
            {format(t.session.repeatMistakes, { count: mistakes.length })}
          </button>
        ) : nextLesson ? (
          <Link to={`/lessons/${nextLesson.slug}`} className={primary}>
            {format(t.session.nextLesson, { title: nextLesson.title })}
          </Link>
        ) : (
          <button type="button" onClick={onRestart} className={primary}>
            {t.session.newSession}
          </button>
        )}
        {(mistakes.length > 0 || nextLesson) && (
          <button type="button" onClick={onRestart} className={quiet}>
            {t.session.newSession}
          </button>
        )}
        {mistakes.length > 0 && nextLesson && (
          <Link to={`/lessons/${nextLesson.slug}`} className={quiet}>
            {format(t.session.nextLesson, { title: nextLesson.title })}
          </Link>
        )}
        {session.lesson && (
          <Link to={`/lessons/${session.lesson}`} className={quiet}>
            {t.session.toLesson}
          </Link>
        )}
      </div>
    </main>
  )
}

/** A one-line reminder of the exercise with the correction in place. */
function Digest({ exercise, result }: { exercise: Exercise; result: ExerciseResult }) {
  const checks = result.check.answers
  switch (exercise.type) {
    case 'fill-gap':
      return <Sentence text={exercise.sentence} gap={<Correction check={checks[0]} />} />
    case 'multiple-choice':
      return exercise.prompt.hasGap ? (
        <Sentence text={exercise.prompt} gap={<Correction check={checks[0]} />} />
      ) : (
        <span className="text-lg">
          {exercise.instruction}: <Correction check={checks[0]} />
        </span>
      )
    case 'declension-table': {
      const open = exercise.rows.filter((r) => r.given === null)
      return (
        <span className="text-lg">
          <b lang="pl">{exercise.word}</b>:{' '}
          {open.map((row, i) => (
            <span key={row.label}>
              {i > 0 && '; '}
              <span className="text-[15px] text-muted">{row.label}</span> <Correction check={checks[i]} />
            </span>
          ))}
        </span>
      )
    }
  }
}
