import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { z } from 'zod'
import type { CheckResponse, Exercise } from '../api/generated/model'

/**
 * Learner state lives in the browser (IndexedDB); the server keeps no user data.
 * It can be exported to a JSON file and imported back on another browser.
 */

export type ExerciseResult = {
  answers: string[]
  check: CheckResponse
  at: string
}

/** A practice session: the exercises it was started with and the results so far. */
export type PracticeSession = {
  /** "lesson:<slug>" for a lesson session, "repeat" for a session of chosen exercises. */
  key: string
  lesson: string | null
  exercises: Exercise[]
  results: Record<string, ExerciseResult>
  startedAt: string
  finishedAt?: string
}

/** An exercise answered wrongly at least once; resolved when later answered correctly. */
export type Mistake = {
  exerciseId: string
  lesson: string
  exercise: Exercise
  answers: string[]
  check: CheckResponse
  count: number
  lastAt: string
  resolved: boolean
}

interface Schema extends DBSchema {
  sessions: { key: string; value: PracticeSession }
  history: { key: number; value: PracticeSession; indexes: { finishedAt: string } }
  mistakes: { key: string; value: Mistake; indexes: { lesson: string } }
}

const DB_NAME = 'polish-app'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<Schema>> | undefined

function db() {
  dbPromise ??= openDB<Schema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('sessions', { keyPath: 'key' })
      database.createObjectStore('history', { autoIncrement: true }).createIndex('finishedAt', 'finishedAt')
      database.createObjectStore('mistakes', { keyPath: 'exerciseId' }).createIndex('lesson', 'lesson')
    },
  })
  return dbPromise
}

/** Closes the connection; tests use it to start from an empty database. */
export async function resetConnection() {
  if (dbPromise) (await dbPromise).close()
  dbPromise = undefined
}

export async function getSession(key: string) {
  return (await db()).get('sessions', key)
}

export async function listSessions() {
  return (await db()).getAll('sessions')
}

export async function saveSession(session: PracticeSession) {
  await (await db()).put('sessions', session)
}

export async function discardSession(key: string) {
  await (await db()).delete('sessions', key)
}

/**
 * Moves a completed session to history and records its mistakes, in one transaction.
 * The active slot is freed, so coming back to the lesson starts a fresh session instead of the old summary.
 */
export async function finishSession(session: PracticeSession) {
  const finished = { ...session, finishedAt: new Date().toISOString() }
  const tx = (await db()).transaction(['sessions', 'history', 'mistakes'], 'readwrite')
  const mistakes = tx.objectStore('mistakes')

  for (const exercise of session.exercises) {
    const result = session.results[exercise.id]
    if (!result) continue
    const previous = await mistakes.get(exercise.id)
    if (result.check.verdict === 'correct') {
      if (previous) await mistakes.put({ ...previous, resolved: true })
    } else {
      await mistakes.put({
        exerciseId: exercise.id,
        lesson: exercise.lesson,
        exercise,
        answers: result.answers,
        check: result.check,
        count: (previous?.count ?? 0) + 1,
        lastAt: result.at,
        resolved: false,
      })
    }
  }

  await tx.objectStore('history').add(finished)
  await tx.objectStore('sessions').delete(session.key)
  await tx.done
  return finished
}

export async function listMistakes() {
  return (await db()).getAll('mistakes')
}

export async function listHistory() {
  return (await db()).getAll('history')
}

const exportSchema = z.object({
  app: z.literal('mow-po-polsku'),
  version: z.literal(1),
  exportedAt: z.string(),
  sessions: z.array(z.looseObject({ key: z.string(), exercises: z.array(z.unknown()), results: z.record(z.string(), z.unknown()) })),
  history: z.array(z.looseObject({ key: z.string(), exercises: z.array(z.unknown()) })),
  mistakes: z.array(z.looseObject({ exerciseId: z.string(), lesson: z.string(), count: z.number() })),
})

export type ExportFile = z.infer<typeof exportSchema>

export async function exportData(): Promise<ExportFile> {
  const database = await db()
  return {
    app: 'mow-po-polsku',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: await database.getAll('sessions'),
    history: await database.getAll('history'),
    mistakes: await database.getAll('mistakes'),
  }
}

/** Replaces all local data with the file's content. Throws when the file is not an export of this app. */
export async function importData(json: unknown) {
  const data = exportSchema.parse(json)
  const tx = (await db()).transaction(['sessions', 'history', 'mistakes'], 'readwrite')
  await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('history').clear(), tx.objectStore('mistakes').clear()])
  for (const s of data.sessions) await tx.objectStore('sessions').put(s as PracticeSession)
  for (const s of data.history) await tx.objectStore('history').add(s as PracticeSession)
  for (const m of data.mistakes) await tx.objectStore('mistakes').put(m as Mistake)
  await tx.done
}
