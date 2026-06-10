# API Layer

How HTTP communication is structured in Testoria.

---

## Overview

```
Component/View
     ↓ (calls store action)
Store (src/stores/<domain>.ts)
     ↓ (calls api function)
src/api/<domain>.ts
     ↓
src/api/client.ts (Axios)
     ↓
Backend at VITE_API_URL
```

Components never touch `api/` directly. All data flows through stores.

---

## `api/client.ts` — the Axios instance

```ts
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
})
```

**Request interceptor**: reads `localStorage.getItem('access_token')` and attaches as `Authorization: Bearer <token>` on every request.

**Response interceptor (401 handling)**:
1. On 401, checks for a refresh token in localStorage
2. POSTs to `/auth/refresh` with the refresh token — concurrent 401s share a single in-flight refresh via a module-level `refreshPromise` (set to `null` in `.finally()` to avoid a stuck lock)
3. On success: stores new tokens, retries the original request
4. On failure: clears tokens, hard-redirects to `/login` via `window.location.href`

The `_retry` flag on the original request config prevents the retried request from triggering another 401 refresh cycle.

---

## Domain API files (`src/api/<domain>.ts`)

Each file exports named async functions. Pattern:

```ts
export async function getTestCases(
  projectId: number,
  filters: TestCaseFilters = {}
): Promise<PaginatedResponse<TestCase>> {
  const response = await apiClient.get<PaginatedResponse<TestCase>>(
    `/projects/${projectId}/test-cases`,
    { params: filters }
  )
  return response.data   // ← unwrap Axios response
}
```

Rules:
- Return `response.data`, not the Axios response object
- Input/output types come from `src/types/`
- No error handling inside api functions — errors bubble up to the store

---

## Multipart uploads

For file uploads (test case import), the api function sets `Content-Type: multipart/form-data`:

```ts
const formData = new FormData()
formData.append('file', file)
formData.append('suite_id', suiteId.toString())

const response = await apiClient.post(
  `/projects/${projectId}/test-cases/import`,
  formData,
  { headers: { 'Content-Type': 'multipart/form-data' } }
)
```

---

## Blob downloads (export)

```ts
const response = await apiClient.get(`/projects/${projectId}/test-cases/export`, {
  params: { format },
  responseType: 'blob'
})
return response.data  // Blob
```

The composables `useExcelExport` and `usePdfExport` generate blobs client-side using ExcelJS and jsPDF — they do not call the backend for export.

---

## Error shape

Backend errors follow:
- `{ detail: string, status_code: number }` — general errors
- `{ detail: ValidationError[] }` — FastAPI validation errors (422)

Stores catch these and set `error.value` as a string message for the UI.
