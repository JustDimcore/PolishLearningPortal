import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { vi } from 'vitest'

/** Renders routes at a path with a fresh query client (no retries). */
export function renderRoutes(routes: RouteObject[], path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/** Stubs fetch with JSON bodies keyed by URL; unknown URLs answer 404. */
export function stubApi(responses: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(
        url in responses
          ? new Response(JSON.stringify(responses[url]))
          : new Response(JSON.stringify({ title: 'Not found' }), { status: 404 }),
      ),
    ),
  )
}
