import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '../i18n/index.ts'
import { PlaceholderPage } from '../pages/PlaceholderPage.tsx'
import { renderRoutes } from '../test/render.tsx'
import { AppLayout } from './AppLayout.tsx'

function renderAt(path: string) {
  return renderRoutes(
    [
      {
        element: <AppLayout />,
        children: [
          { path: 'lessons', element: <PlaceholderPage title={t.nav.lessons} note="" /> },
          { path: 'cheatsheet', element: <PlaceholderPage title={t.nav.cheatsheet} note="" /> },
        ],
      },
    ],
    path,
  )
}

describe('AppLayout', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('highlights the active section and shows the API version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'Mów po polsku!', version: '1.0.0' }))),
    )

    renderAt('/cheatsheet')

    expect(screen.getByRole('heading', { level: 1, name: t.nav.cheatsheet })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.nav.cheatsheet })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByText(/Mów po polsku! · 1\.0\.0/)).toBeInTheDocument()
  })

  it('reports when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))

    renderAt('/lessons')

    expect(await screen.findByText(t.apiStatus.unavailable)).toBeInTheDocument()
  })
})
