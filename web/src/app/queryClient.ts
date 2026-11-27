import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from '../shared/api/fetcher.ts'
import { getGetVersionQueryKey } from '../shared/api/generated/app-info/app-info.ts'

/**
 * Query client of the app. GET /api/version doubles as the connection probe behind the "server unavailable"
 * notice: whenever another request fails for a reason other than a client error, the probe runs again.
 */
export function createQueryClient() {
  const probeKey = getGetVersionQueryKey()
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        const isClientError = error instanceof ApiError && error.status < 500
        if (!isClientError && query.queryKey[0] !== probeKey[0]) {
          void client.refetchQueries({ queryKey: probeKey })
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // Client errors (404 and the like) will not change on retry.
        retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status < 500),
      },
    },
  })
  return client
}
