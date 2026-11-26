/** Error for non-2xx responses; `problem` holds the server's ProblemDetails body when there is one. */
export class ApiError extends Error {
  readonly status: number
  readonly problem: unknown

  constructor(status: number, problem: unknown) {
    super(`API responded with ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

/** Fetch wrapper used by the generated client: returns parsed JSON or throws ApiError. */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const text = await response.text()
  const body: unknown = text ? JSON.parse(text) : undefined
  if (!response.ok) throw new ApiError(response.status, body)
  return body as T
}

/** Error type Orval uses for generated hooks: every failed request surfaces as ApiError. */
export type ErrorType<_Problem> = ApiError
