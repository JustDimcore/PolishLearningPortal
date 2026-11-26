import { useQuery } from '@tanstack/react-query'

// Temporary hand-written client. Once real endpoints exist,
// the client and schemas will be generated from OpenAPI (Orval).
export type VersionResponse = {
  name: string
  version: string
}

export async function fetchVersion(signal?: AbortSignal): Promise<VersionResponse> {
  const response = await fetch('/api/version', { signal })
  if (!response.ok) throw new Error(`API responded with ${response.status}`)
  return (await response.json()) as VersionResponse
}

export function useApiVersion() {
  return useQuery({
    queryKey: ['version'],
    queryFn: ({ signal }) => fetchVersion(signal),
  })
}
