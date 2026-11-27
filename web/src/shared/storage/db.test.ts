import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CheckResponse, Exercise } from '../api/generated/model'
import {
  exportData,
  finishSession,
  getSession,
  importData,
  listHistory,
  listMistakes,
  resetConnection,
  saveSession,
  type PracticeSession,
} from './db.ts'

const exercise = (id: string): Exercise => ({
  type: 'fill-gap',
  id,
  lesson: 'dopelniacz',
  instruction: 'Fill',
  translation: null,
  base: 'sklep',
  sentence: { before: [], hasGap: true, after: [] },
})

const check = (verdict: CheckResponse['verdict']): CheckResponse => ({
  verdict,
  answers: [{ given: 'x', expected: 'sklepu', verdict }],
  explanation: [],
})

function session(results: Record<string, CheckResponse['verdict']>): PracticeSession {
  return {
    key: 'lesson:dopelniacz',
    lesson: 'dopelniacz',
    exercises: Object.keys(results).map(exercise),
    results: Object.fromEntries(
      Object.entries(results).map(([id, verdict]) => [id, { answers: ['x'], check: check(verdict), at: '2026-01-01' }]),
    ),
    startedAt: '2026-01-01',
  }
}

describe('local storage of progress', () => {
  beforeEach(async () => {
    await resetConnection()
    globalThis.indexedDB = new IDBFactory()
  })

  it('keeps an unfinished session', async () => {
    await saveSession(session({ a: 'correct' }))

    expect((await getSession('lesson:dopelniacz'))?.results.a.check.verdict).toBe('correct')
  })

  it('records mistakes when a session ends and resolves them on a later correct answer', async () => {
    await finishSession(session({ a: 'wrong', b: 'correct', c: 'almost' }))

    let mistakes = await listMistakes()
    expect(mistakes.map((m) => [m.exerciseId, m.count, m.resolved])).toEqual([
      ['a', 1, false],
      ['c', 1, false],
    ])

    await finishSession(session({ a: 'correct', c: 'wrong' }))

    mistakes = await listMistakes()
    expect(mistakes.map((m) => [m.exerciseId, m.count, m.resolved])).toEqual([
      ['a', 1, true],
      ['c', 2, false],
    ])
    expect(await listHistory()).toHaveLength(2)
    expect(await getSession('lesson:dopelniacz')).toBeUndefined()
  })

  it('exports and imports everything, replacing current data', async () => {
    await finishSession(session({ a: 'wrong' }))
    const file = JSON.parse(JSON.stringify(await exportData())) as unknown

    await resetConnection()
    globalThis.indexedDB = new IDBFactory()
    await saveSession({ ...session({ z: 'correct' }), key: 'other' })

    await importData(file)

    expect(await getSession('other')).toBeUndefined()
    expect((await listMistakes()).map((m) => m.exerciseId)).toEqual(['a'])
    expect(await listHistory()).toHaveLength(1)
  })

  it('rejects files that are not an export of this app', async () => {
    await expect(importData({ hello: 'world' })).rejects.toThrow()
  })
})
