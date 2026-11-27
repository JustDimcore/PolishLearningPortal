import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { t } from '../i18n/index.ts'
import { LessonsPage } from '../pages/lessons/LessonsPage.tsx'
import { PlaceholderPage } from '../pages/PlaceholderPage.tsx'
import { renderRoutes } from '../test/render.tsx'
import { AppLayout } from './AppLayout.tsx'
import { createQueryClient } from './queryClient.ts'

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

  it('highlights the active section and shows no API notice while the server is reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'Mów po polsku!', version: '1.0.0' }))),
    )

    renderAt('/cheatsheet')

    expect(screen.getByRole('heading', { level: 1, name: t.nav.cheatsheet })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: t.nav.cheatsheet })).toHaveAttribute('aria-current', 'page')
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('reports when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })))

    renderAt('/lessons')

    expect(await screen.findByRole('alert')).toHaveTextContent(t.apiStatus.unavailable)
  })

  it('shows the notice when the server goes down after the page has loaded', async () => {
    let up = true
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          up && url === '/api/version'
            ? new Response(JSON.stringify({ name: 'Mów po polsku!', version: '1.0.0' }))
            : new Response('', { status: 502 }),
        ),
      ),
    )
    const client = createQueryClient()
    client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retryDelay: 0 } })

    renderRoutes([{ element: <AppLayout />, children: [{ path: 'lessons', element: <LessonsPage /> }] }], '/lessons', client)
    up = false

    expect(await screen.findByText(t.apiStatus.unavailable, {}, { timeout: 3000 })).toHaveAttribute('role', 'alert')
  })
})
