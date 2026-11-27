import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { format, t } from '../../i18n/index.ts'
import type { CheckResponse, SessionResponse } from '../../shared/api/generated/model'
import { resetConnection } from '../../shared/storage/db.ts'
import { renderRoutes } from '../../test/render.tsx'
import { SessionPage } from './SessionPage.tsx'

const text = (value: string) => [{ text: value, marks: [] }]

const session: SessionResponse = {
  lesson: 'dopelniacz',
  exercises: [
    {
      type: 'fill-gap',
      id: 'e1',
      lesson: 'dopelniacz',
      instruction: 'Fill the gap',
      translation: null,
      base: 'sklep',
      sentence: { before: text('Idę do '), hasGap: true, after: text('.') },
    },
    {
      type: 'multiple-choice',
      id: 'e2',
      lesson: 'dopelniacz',
      instruction: 'Pick one',
      translation: null,
      prompt: { before: text('Nie mam '), hasGap: true, after: text('.') },
      options: ['czasu', 'czas'],
    },
  ],
}

const wrong: CheckResponse = {
  verdict: 'wrong',
  answers: [{ given: 'sklepa', expected: 'sklepu', verdict: 'wrong' }],
  explanation: text('Because.'),
}
const right: CheckResponse = {
  verdict: 'correct',
  answers: [{ given: 'czasu', expected: 'czasu', verdict: 'correct' }],
  explanation: text('Yes.'),
}

function stubServer() {
  const fetchMock = vi.fn((url: string) => {
    const body =
      url.startsWith('/api/exercises/session') ? session
      : url === '/api/exercises/e1/check' ? wrong
      : url === '/api/exercises/e2/check' ? right
      : { groups: [] }
    return Promise.resolve(new Response(JSON.stringify(body)))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderSession = () => renderRoutes([{ path: '/exercises/:lesson', element: <SessionPage /> }], '/exercises/dopelniacz')

describe('SessionPage', () => {
  beforeEach(async () => {
    await resetConnection()
    globalThis.indexedDB = new IDBFactory()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the verdict in place and moves on only on "Next"', async () => {
    stubServer()
    renderSession()

    fireEvent.change(await screen.findByLabelText(t.session.answerLabel), { target: { value: 'sklepa' } })
    fireEvent.click(screen.getByRole('button', { name: t.session.check }))

    expect(await screen.findByText(t.session.resultWrong)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Fill the gap' })).toBeInTheDocument()
    expect(screen.getByText('sklepu')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: t.session.next }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pick one' })).toBeInTheDocument()
  })

  it('ends with a summary listing the mistakes', async () => {
    stubServer()
    renderSession()

    fireEvent.change(await screen.findByLabelText(t.session.answerLabel), { target: { value: 'sklepa' } })
    fireEvent.click(screen.getByRole('button', { name: t.session.check }))
    fireEvent.click(await screen.findByRole('button', { name: t.session.next }))

    // Picking an option checks it right away.
    fireEvent.click(await screen.findByRole('button', { name: 'czasu' }))
    fireEvent.click(await screen.findByRole('button', { name: t.session.finish }))

    expect(await screen.findByRole('heading', { level: 1, name: t.session.summaryTitle })).toBeInTheDocument()
    expect(screen.getByText(format(t.session.mistakesCount, { count: 1 }), { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: format(t.session.repeatMistakes, { count: 1 }) })).toBeInTheDocument()
  })

  it('resumes a stored session instead of starting a new one', async () => {
    const fetchMock = stubServer()
    const first = renderSession()
    await screen.findByLabelText(t.session.answerLabel)
    first.unmount()

    renderSession()
    await screen.findByLabelText(t.session.answerLabel)

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/exercises/session'))).toHaveLength(1),
    )
  })

  it('types Polish letters into the answer at the caret', async () => {
    stubServer()
    renderSession()

    const input = await screen.findByLabelText<HTMLInputElement>(t.session.answerLabel)
    fireEvent.change(input, { target: { value: 'kobita' } })
    input.focus()
    input.setSelectionRange(5, 5)
    fireEvent.click(screen.getByRole('button', { name: format(t.session.insertLetter, { letter: 'ę' }) }))

    expect(input).toHaveValue('kobitęa')
  })

  it('explains an empty answer instead of checking it', async () => {
    const fetchMock = stubServer()
    renderSession()

    const input = await screen.findByLabelText(t.session.answerLabel)
    fireEvent.click(screen.getByRole('button', { name: t.session.check }))

    expect(screen.getByText(t.session.missingAnswer)).toBeInTheDocument()
    expect(input).toHaveAccessibleDescription(t.session.missingAnswer)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/check'))).toBe(false)
  })

  it('makes the letter row a single Tab stop navigated with arrows', async () => {
    stubServer()
    renderSession()

    const group = await screen.findByRole('group', { name: t.session.letters })
    const letters = Array.from(group.querySelectorAll('button'))
    expect(letters.filter((b) => b.tabIndex === 0)).toHaveLength(1)

    letters[0].focus()
    fireEvent.keyDown(letters[0], { key: 'ArrowRight' })

    expect(letters[1]).toHaveFocus()
    expect(letters[1].tabIndex).toBe(0)
  })

  it('starts a fresh session when coming back after finishing one', async () => {
    const fetchMock = stubServer()
    const first = renderSession()

    fireEvent.change(await screen.findByLabelText(t.session.answerLabel), { target: { value: 'sklepa' } })
    fireEvent.click(screen.getByRole('button', { name: t.session.check }))
    fireEvent.click(await screen.findByRole('button', { name: t.session.next }))
    fireEvent.click(await screen.findByRole('button', { name: 'czasu' }))
    fireEvent.click(await screen.findByRole('button', { name: t.session.finish }))
    await screen.findByRole('heading', { level: 1, name: t.session.summaryTitle })
    first.unmount()

    renderSession()

    expect(await screen.findByLabelText(t.session.answerLabel)).toHaveValue('')
    expect(screen.queryByRole('heading', { level: 1, name: t.session.summaryTitle })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/exercises/session'))).toHaveLength(2)
  })
})
