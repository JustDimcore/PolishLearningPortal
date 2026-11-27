import { useQuery, useQueryClient } from '@tanstack/react-query'
import { checkAnswer, startSession } from '../../shared/api/generated/exercises/exercises.ts'
import type { Exercise, StartSessionParams } from '../../shared/api/generated/model'
import { discardSession, finishSession, getSession, saveSession, type PracticeSession } from '../../shared/storage/db.ts'

export const sessionQueryKey = (key: string) => ['local', 'session', key] as const

/**
 * The session stored under `key`, started on the server when there is none yet, so a reload resumes it.
 * Answers are checked by the server and the session is saved after each one.
 */
export function usePracticeSession(key: string, params: StartSessionParams) {
  const queryClient = useQueryClient()
  const queryKey = sessionQueryKey(key)

  const query = useQuery({
    queryKey,
    staleTime: Infinity,
    // Storage is the source of truth: drop the in-memory copy on leaving, so a session finished earlier
    // never comes back from the cache (not even for a moment) and each visit re-reads IndexedDB.
    gcTime: 0,
    queryFn: async ({ signal }): Promise<PracticeSession> => {
      const stored = await getSession(key)
      // A finished session is history: coming back starts over. (Older data kept finished sessions here.)
      if (stored && !stored.finishedAt) return stored
      if (stored) await discardSession(key)
      const started = await startSession(params, { signal })
      const session: PracticeSession = {
        key,
        lesson: started.lesson ?? null,
        exercises: started.exercises,
        results: {},
        startedAt: new Date().toISOString(),
      }
      await saveSession(session)
      return session
    },
  })

  async function answer(exercise: Exercise, answers: string[]) {
    const session = query.data
    if (!session) return
    const check = await checkAnswer(exercise.id, { answers })
    let updated: PracticeSession = {
      ...session,
      results: { ...session.results, [exercise.id]: { answers, check, at: new Date().toISOString() } },
    }
    const complete = updated.exercises.every((e) => updated.results[e.id])
    if (complete) updated = await finishSession(updated)
    else await saveSession(updated)
    queryClient.setQueryData(queryKey, updated)
    if (complete) await queryClient.invalidateQueries({ queryKey: ['local', 'mistakes'] })
  }

  /** Drops the stored session; the query then starts a new one. */
  async function restart() {
    await discardSession(key)
    await queryClient.resetQueries({ queryKey })
  }

  return { ...query, answer, restart }
}
