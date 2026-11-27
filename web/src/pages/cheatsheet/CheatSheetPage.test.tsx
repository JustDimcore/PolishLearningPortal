import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { format, t } from '../../i18n/index.ts'
import type { CheatSheetResponse, FormSearchResponse } from '../../shared/api/generated/model'
import { renderRoutes, stubApi } from '../../test/render.tsx'
import { CheatSheetPage } from './CheatSheetPage.tsx'

const text = (value: string) => [{ text: value, marks: [] }]

const sheet: CheatSheetResponse = {
  title: 'Ściąga',
  summary: text('Summary.'),
  sections: [
    {
      id: 'section-1',
      number: 1,
      title: 'Declension',
      blocks: [
        {
          type: 'table',
          hasRowHeaders: true,
          header: { cells: [{ content: [] }, { content: text('f.') }] },
          rows: [
            { cells: [{ content: text('C') }, { content: text('kobiecie') }] },
            { cells: [{ content: text('Ms') }, { content: text('kobiecie') }] },
          ],
        },
      ],
    },
  ],
}

const hit = (row: number, rowLabel: string) => ({
  form: 'kobiecie',
  sectionId: 'section-1',
  sectionNumber: 1,
  sectionTitle: 'Declension',
  block: 0,
  row,
  column: 1,
  rowLabel,
  columnLabel: 'f.',
})

const found: FormSearchResponse = { query: 'kobiecie', exact: true, hits: [hit(0, 'C'), hit(1, 'Ms')] }
const missing: FormSearchResponse = { query: 'kobietom', exact: true, hits: [] }

function renderSheet() {
  return renderRoutes([{ path: '/cheatsheet', element: <CheatSheetPage /> }], '/cheatsheet')
}

describe('CheatSheetPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders tables with row headers and addressable cells', async () => {
    stubApi({ '/api/cheatsheet': sheet })

    renderSheet()

    expect(await screen.findByRole('heading', { level: 1, name: 'Ściąga' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Ms' })).toBeInTheDocument()
    expect(document.getElementById('section-1-b0-r1-c1')).toHaveTextContent('kobiecie')
    expect(screen.getByRole('link', { name: /Declension/ })).toHaveAttribute('href', '#section-1')
  })

  it('lists search hits that link to the matching cells', async () => {
    stubApi({ '/api/cheatsheet': sheet, '/api/cheatsheet/search?q=kobiecie': found })

    renderSheet()
    fireEvent.change(await screen.findByLabelText(t.cheatsheet.searchLabel), { target: { value: 'kobiecie' } })

    expect(await screen.findByText(format(t.cheatsheet.found, { count: 2 }))).toHaveAttribute('role', 'status')
    const nav = screen.getByRole('navigation', { name: t.cheatsheet.sideLabel })
    const links = within(nav).getAllByRole('link', { name: /kobiecie/ })
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['#section-1-b0-r0-c1', '#section-1-b0-r1-c1'])
    expect(links[1]).toHaveTextContent('Ms, f.')
  })

  it('says when the form is not on the sheet', async () => {
    stubApi({ '/api/cheatsheet': sheet, '/api/cheatsheet/search?q=kobietom': missing })

    renderSheet()
    fireEvent.change(await screen.findByLabelText(t.cheatsheet.searchLabel), { target: { value: 'kobietom' } })

    expect(await screen.findByText(t.cheatsheet.notFound)).toBeInTheDocument()
    expect(screen.getByText(t.cheatsheet.notFoundNote)).toBeInTheDocument()
  })
})
