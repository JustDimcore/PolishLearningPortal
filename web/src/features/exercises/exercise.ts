import type { Exercise } from '../../shared/api/generated/model'
import type { PracticeSession } from '../../shared/storage/db.ts'

/** Number of answers an exercise takes. */
export function gapCount(exercise: Exercise) {
  return exercise.type === 'declension-table' ? exercise.rows.filter((r) => r.given === null).length : 1
}

/** Index of the first exercise without a result, or -1 when all are answered. */
export function firstOpen(session: PracticeSession) {
  return session.exercises.findIndex((e) => !session.results[e.id])
}

export function score(session: PracticeSession) {
  const results = session.exercises.map((e) => session.results[e.id])
  const correct = results.filter((r) => r?.check.verdict === 'correct').length
  const answered = results.filter(Boolean).length
  return { correct, wrong: answered - correct, left: session.exercises.length - answered }
}
