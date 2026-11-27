import { format, t } from '../../i18n/index.ts'
import type { PracticeSession } from '../../shared/storage/db.ts'
import { score } from './exercise.ts'

/**
 * A thin bar with one segment per exercise, plus the counts as text, so the colour is not the only cue.
 * Screen readers get the whole picture from the label.
 */
export function Progress({ session }: { session: PracticeSession }) {
  const { correct, wrong, left } = score(session)
  return (
    <div role="img" aria-label={format(t.session.progress, { correct, wrong, left })} className="flex items-center gap-3">
      <div className="flex flex-1 gap-1">
        {session.exercises.map((exercise) => {
          const verdict = session.results[exercise.id]?.check.verdict
          const color = verdict === undefined ? 'bg-surface' : verdict === 'correct' ? 'bg-ink' : 'bg-vermilion-dark'
          return <span key={exercise.id} aria-hidden="true" className={`h-2 flex-1 ${color}`} />
        })}
      </div>
      <span aria-hidden="true" className="text-xs whitespace-nowrap text-muted">
        ✓ {correct} · <span className="text-vermilion-dark">✕ {wrong}</span>
      </span>
    </div>
  )
}
