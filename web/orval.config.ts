import { defineConfig } from 'orval'

// openapi.json is written by `dotnet build` of src/Api; run `npm run api:generate` after changing endpoints.
export default defineConfig({
  api: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/shared/api/generated',
      schemas: './src/shared/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        fetch: { includeHttpResponseReturnType: false },
        mutator: { path: './src/shared/api/fetcher.ts', name: 'apiFetch' },
      },
    },
  },
  apiZod: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/shared/api/generated',
      client: 'zod',
      fileExtension: '.zod.ts',
    },
  },
})
