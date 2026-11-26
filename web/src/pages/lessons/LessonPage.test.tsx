import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { format, t } from '../../i18n/index.ts'
import type { CourseOutline, LessonDetail } from '../../shared/api/generated/model'
import { renderRoutes, stubApi } from '../../test/render.tsx'
import { LessonPage } from './LessonPage.tsx'

const text = (value: string) => [{ text: value, marks: [] }]

const course: CourseOutline = {
  groups: [
    {
      id: 'cases',
      title: 'Cases',
      lessons: [
        { slug: 'mianownik', number: 1, title: 'Mianownik', subtitle: 'kto? co?' },
        { slug: 'dopelniacz', number: 2, title: 'Dopełniacz', subtitle: 'kogo? czego?' },
      ],
    },
  ],
}

const lesson: LessonDetail = {
  slug: 'dopelniacz',
  number: 2,
  title: 'Dopełniacz',
  subtitle: 'kogo? czego?',
  summary: text('Summary.'),
  minutes: 12,
  group: { id: 'cases', title: 'Cases', position: 2, count: 2 },
  sections: [
    {
      id: 'section-1',
      number: 1,
      title: 'Usage',
      blocks: [
        {
          type: 'examples',
          items: [
            {
              label: 'Negation',
              text: [
                { text: 'Nie mam czas', marks: [] },
                { text: 'u', marks: ['ending'] },
              ],
              translation: text('No time.'),
            },
          ],
        },
        { type: 'note', content: text('A note.') },
      ],
    },
    {
      id: 'section-2',
      number: 2,
      title: 'Shop',
      blocks: [
        { type: 'card', title: 'Lista zakupów', caption: null, items: [{ content: text('woda') }] },
        {
          type: 'dialogue',
          caption: 'Genitive',
          lines: [{ text: text('Coś jeszcze?'), translation: text('Anything else?'), remark: 'a remark' }],
        },
      ],
    },
  ],
  previous: { slug: 'mianownik', number: 1, title: 'Mianownik', subtitle: 'kto? co?' },
  next: null,
}

function renderLesson(slug: string) {
  return renderRoutes([{ path: '/lessons/:slug', element: <LessonPage /> }], `/lessons/${slug}`)
}

describe('LessonPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the lesson with its plan, sections and neighbours', async () => {
    stubApi({ '/api/lessons': course, '/api/lessons/dopelniacz': lesson })

    renderLesson('dopelniacz')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dopełniacz' })).toBeInTheDocument()
    expect(screen.getByText(format(t.lessons.position, { group: 'Cases', position: 2, count: 2 }))).toBeInTheDocument()

    const plan = screen.getByRole('navigation', { name: t.lessons.plan })
    expect(within(plan).getByRole('link', { name: /Usage/ })).toHaveAttribute('href', '#section-1')
    expect(screen.getByRole('heading', { level: 2, name: /Shop/ })).toBeInTheDocument()

    const ending = screen.getByText('u')
    expect(ending.tagName).toBe('B')
    expect(ending).toHaveClass('text-cobalt')

    expect(screen.getByText('Lista zakupów')).toBeInTheDocument()
    expect(screen.getByText(/a remark/)).toBeInTheDocument()
    expect(screen.getByText('Genitive')).toBeInTheDocument()

    const neighbours = screen.getByRole('navigation', { name: t.lessons.neighbours })
    expect(within(neighbours).getByRole('link', { name: /Mianownik/ })).toHaveAttribute('href', '/lessons/mianownik')
  })

  it('marks the current lesson in the course navigation', async () => {
    stubApi({ '/api/lessons': course, '/api/lessons/dopelniacz': lesson })

    renderLesson('dopelniacz')

    const nav = await screen.findByRole('navigation', { name: t.lessons.courseNav })
    expect(await within(nav).findByRole('link', { name: /Dopełniacz/ })).toHaveAttribute('aria-current', 'page')
  })

  it('shows "not found" for an unknown lesson', async () => {
    stubApi({ '/api/lessons': course })

    renderLesson('nope')

    expect(await screen.findByRole('heading', { level: 1, name: t.lessons.notFoundTitle })).toBeInTheDocument()
  })
})
