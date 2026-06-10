# API SCHEMA — Frontend API Layer
# Derived from: src/api/*.ts
# Base URL: VITE_API_URL (default: http://localhost:8000/api/v1)
# Update this file when API functions are added or changed.

---

## Auth (`src/api/auth.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `login` | POST | `/auth/login` | `LoginRequest` | `TokenResponse` |
| `logout` | POST | `/auth/logout` | — | `void` |
| `refreshToken` | POST | `/auth/refresh` | `{ refresh_token }` | `TokenResponse` |
| `getCurrentUser` | GET | `/auth/me` | — | `User` |
| `getRoles` | GET | `/roles` | — | `Role[]` |
| `forgotPassword` | POST | `/auth/forgot-password` | `ForgotPasswordRequest` (`{ email }`) | `void` (202; no enumeration) |
| `resetPassword` | POST | `/auth/reset-password` | `ResetPasswordRequest` (`{ token, new_password }`) | `void` (200; 400 on invalid/expired/used token) |
| `validateResetToken` | GET | `/auth/reset-password/validate` | `token` query param | `ResetTokenValidateResponse` (`{ valid, username }`; 400 on invalid token) |

> The three recovery functions back the public forgot/reset/set-password screens and depend on api-testoria plan 048. `forgotPassword` and `resetPassword` resolve to `void` (the success message body is not surfaced); the views render fixed copy. `validateResetToken` is called on mount of `ResetPasswordView.vue` to gate the form. There is **no `register` function** — public self-registration was removed in plan-098 / api 049; accounts are created only via `createUser` / `bulkCreateUsers` (`src/api/users.ts`), which are **invite-only**: `UserCreate` has no `password` field and the backend emails a welcome set-password link.

---

## Projects (`src/api/projects.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getProjects` | GET | `/projects` | `ProjectFilters` | `PaginatedResponse<Project>` |
| `getProject` | GET | `/projects/:id` | — | `Project` |
| `createProject` | POST | `/projects` | `ProjectCreate` | `Project` |
| `updateProject` | PUT | `/projects/:id` | `ProjectUpdate` | `Project` |
| `deleteProject` | DELETE | `/projects/:id` | — | `void` |
| `getProjectStats` | GET | `/projects/:id/stats` | — | `ProjectStats` |
| `getProjectStatsBulk` | GET | `/projects/stats` | `ProjectStatsBulkParams` (`include_archived?`, `project_ids?`) | `ProjectStatsBulkResponse` |

### ProjectFilters
`include_archived?`, `page?`, `page_size?` — `include_archived: true` returns archived projects alongside active ones; default (omitted or `false`) returns only non-archived. Param name matches the backend (`app/api/v1/projects.py: list_projects`) and the existing `ProjectStatsBulkParams.include_archived` (plan-085).

### ProjectStatsItem
`project_id`, `name`, `is_archived`, `total_test_cases`, `total_test_suites`, `total_test_runs`, `active_runs`, `pass_rate` (ratio in `[0, 1]` or `null`). `pass_rate` is the arithmetic mean of each completed run's own pass rate across the project's completed runs (plan 041). Each run's pass rate is `passed / max(cases_in_scope, tested)` — the same formula surfaced by `TestRun.progress.pass_rate` — so Dashboard tile, per-project breakdown, and Reports KPI agree for a given run. Runs whose own pass rate is `null` (empty completed runs) don't contribute.

---

## Test Suites (`src/api/testSuites.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getTestSuites` | GET | `/projects/:projectId/test-suites` | — | `TestSuite[]` |
| `getTestSuite` | GET | `/test-suites/:id` | — | `TestSuite` |
| `createTestSuite` | POST | `/projects/:projectId/test-suites` | `TestSuiteCreate` | `TestSuite` |
| `updateTestSuite` | PUT | `/test-suites/:id` | `TestSuiteUpdate` | `TestSuite` |
| `deleteTestSuite` | DELETE | `/test-suites/:id` | — | `void` |

**`TestSuite` response / Create / Update** accept `display_order?: number | null` (plan-093). Sort on the wire is `(display_order NULLS LAST, created_at ASC, id ASC)`. `PUT` rejects `parent_suite_id` set to one of the suite's own descendants with `400` (api plan-046 cycle check).

---

## Test Cases (`src/api/testCases.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getTestCases` | GET | `/projects/:projectId/test-cases` | `TestCaseFilters` | `PaginatedResponse<TestCase>` |
| `getTestCase` | GET | `/test-cases/:id` | — | `TestCase` |
| `createTestCase` | POST | `/projects/:projectId/test-cases` | `TestCaseCreate` | `TestCase` |
| `updateTestCase` | PUT | `/test-cases/:id` | `TestCaseUpdate` | `TestCase` |
| `deleteTestCase` | DELETE | `/test-cases/:id` | — | `void` |
| `importTestCases` | POST | `/projects/:projectId/test-cases/import` | `FormData (file, suite_id)` | `{ imported, errors[] }` |
| `exportTestCases` | GET | `/projects/:projectId/test-cases/export` | `{ format: 'csv'\|'excel' }` | `Blob` |

**`TestCase` response** includes `automation_id?: string | null` and `display_order?: number | null` (plan-093 + api plan-046).
**`TestCaseCreate`** and **`TestCaseUpdate`** payloads accept `automation_id?: string | null` (empty string coerced to `null`) and `display_order?: number | null`. Sort on the wire is `(display_order NULLS LAST, created_at ASC, id ASC)`.

### TestCaseFilters
`suite_id?`, `priority?`, `type?`, `status?`, `search?`, `tag_ids?: number[]`, `page?`, `page_size?`

---

## Tags (`src/api/tags.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getTags` | GET | `/tags` | — | `Tag[]` |
| `searchTags` | GET | `/tags` | `{ q, limit? }` | `Tag[]` |
| `createTag` | POST | `/tags` | `{ name }` | `Tag` |

---

## Test Runs (`src/api/testRuns.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getTestRuns` | GET | `/projects/:projectId/test-runs` | `TestRunFilters` | `PaginatedResponse<TestRun>` |
| `getTestRun` | GET | `/test-runs/:id` | — | `TestRun` |
| `createTestRun` | POST | `/projects/:projectId/test-runs` | `TestRunCreate` | `TestRun` |
| `updateTestRun` | PUT | `/test-runs/:id` | `TestRunUpdate` | `TestRun` |
| `deleteTestRun` | DELETE | `/test-runs/:id` | — | `void` |
| `closeTestRun` | POST | `/test-runs/:id/close` | — | `TestRun` |
| `getTestRunProgress` | GET | `/test-runs/:id/progress` | — | `TestRunProgress` |
| `getTestRunCases` | GET | `/test-runs/:id/cases` | — | `TestRunWithCases` |
| `setRunCases` | PUT | `/test-runs/:id/cases` | `{ test_case_ids: number[] }` | `TestRun` |

### TestRunFilters
`status?`, `milestone_id?`, `assigned_to?`, `page?`, `page_size?`

### TestRunCreate — explicit case selection
`createTestRun` meaningfully sends `include_test_cases: number[]` — a flat list of test case IDs to include in the run. This array is populated from the suite tree selector in `TestRunCreateView` (plan-045): checking a suite auto-selects all its descendant case IDs; individual cases can also be toggled independently. An empty array is rejected by the backend (at least one case required).

### TestRunWithCases — shape
`getTestRunCases` returns `{ run: TestRun, cases: TestCaseWithResult[] }` where `TestCaseWithResult` extends `TestCase` with a nullable `result: TestResult | null`. When `result` is null the case has not been executed yet; `TestRunDetailView` synthesises a client-only `TestResult` row with `id: null` and `status: "no_run"` for display (plan-055). Synthetic rows must never be sent back to the backend — call sites that submit/update/fetch-history guard on `id != null`.

---

## Milestones (`src/api/milestones.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getMilestones` | GET | `/projects/:projectId/milestones` | — | `Milestone[]` |
| `createMilestone` | POST | `/projects/:projectId/milestones` | `MilestoneCreate` | `Milestone` |
| `updateMilestone` | PUT | `/milestones/:id` | `MilestoneUpdate` | `Milestone` |
| `deleteMilestone` | DELETE | `/milestones/:id` | — | `void` |

---

## Test Results (`src/api/testResults.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getTestResults` | GET | `/test-runs/:runId/results` | — | `TestResult[]` |
| `getTestResult` | GET | `/test-results/:id` | — | `TestResult` |
| `submitTestResult` | POST | `/test-runs/:runId/results` | `TestResultCreate` | `TestResult` |
| `updateTestResult` | PUT | `/test-results/:id` | `TestResultUpdate` | `TestResult` |
| `getTestResultHistory` | GET | `/test-results/:id/history` | — | `TestResultHistory[]` |
| `uploadAttachment` | POST | `/test-results/:id/attachments` | `FormData (file)` | `Attachment` |
| `uploadAttachmentsBulk` | POST | `/test-results/:id/attachments/bulk` | `FormData (files[])` | `BulkUploadResponse` |
| `deleteAttachment` | DELETE | `/test-results/:id/attachments/:attachId` | — | `void` |

### StepResult type (plan-047)

`TestResult`, `TestResultCreate`, and `TestResultUpdate` now include an optional `step_results` field:

```ts
StepResult = { index: number, status: ResultStatus, comment?: string | null }

// added to TestResult, TestResultCreate, TestResultUpdate:
step_results?: StepResult[] | null
```

`index` matches the zero-based position of the step in the test case's `steps` array. `status` uses the same `ResultStatus` enum as the overall result (`passed | failed | blocked | no_run`). The field is nullable/omittable — partial coverage (only some steps marked) is valid.

---

## Reports (`src/api/reports.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getDashboardData` | GET | `/projects/:id/dashboard` | — | `DashboardData` |
| `getTestRunMetrics` | GET | `/test-runs/:id/report` | `format: 'json'` | `TestRunMetrics` |
| `downloadReport` | GET | `/test-runs/:id/report` | `format: 'pdf'\|'excel'` | `Blob` |
| `getProjectMetrics` | GET | `/projects/:id/metrics` | `days?: number` | `ProjectMetrics` |
| `getCustomReport` | POST | `/reports/custom` | `CustomReportRequest` | `CustomReportResponse` |
| `getProjectReportAnalytics` | GET | `/projects/:id/report-analytics` | `ReportAnalyticsParams` (`date_from?`, `date_to?`, `run_status?`, `include_trend?`) | `ProjectReportAnalytics` |
| `getCrossProjectReportAnalytics` | GET | `/reports/analytics` | `CrossProjectReportAnalyticsParams` (`project_ids?`, `date_from?`, `date_to?`, `run_status?`, `include_trend?`, `include_archived?`) | `CrossProjectReportAnalytics` |

All `pass_rate` ratios returned by the API are rounded to 3 decimal places (= 1 decimal of percent) at the response boundary (api plan 044). The frontend formats with `formatPassRate` (string) or `toPercentRounded` (number) for an additional 1-decimal rounding step that's idempotent against the server-rounded value (plan-083).

`getCrossProjectReportAnalytics` calls the cross-project mirror of `getProjectReportAnalytics` (api plan 043) — same `summary` / `runs` / `test_case_distribution` / `trend` fields plus `per_project: PerProjectAnalyticsRow[]` (one row per in-scope project). Used by the Reports page when the user picks "All projects". `project_ids` is serialised as repeated query params (`?project_ids=1&project_ids=2`) via `paramsSerializer: { indexes: null }` — same convention as `getProjectStatsBulk`. `RunAnalyticsItem` now carries `project_id: number` (always) and `project_name?: string | null` (populated only by this endpoint).

---

## Users (`src/api/users.ts`)

| Function | Method | Path | Input | Output |
|----------|--------|------|-------|--------|
| `getUsers` | GET | `/users` | `UserFilters` | `PaginatedResponse<User>` |
| `getUser` | GET | `/users/:id` | — | `User` |
| `createUser` | POST | `/users` | `UserCreate` | `User` |
| `bulkCreateUsers` | POST | `/users/bulk` | `UserBulkCreate` | `UserBulkResult` |
| `updateUser` | PUT | `/users/:id` | `UserUpdate` | `User` |
| `deleteUser` | DELETE | `/users/:id` | — | `void` |
| `exportUsers` | GET | `/users/export` | `{ format: 'csv'\|'excel' }` | `Blob` |

> All `/users*` endpoints require **Lead or Admin** (route `minRole: "lead"`; backend `require_role(LEAD, ADMIN)`). `UserCreate` is **invite-only** — no `password` field; the backend emails a set-password link. A **Lead is capped at Lead**: the UI hides the Admin role option and Admin-row edit/delete for non-admins, and the backend returns 403 on any attempt to create/elevate/modify/delete an Admin (api plan 049).
>
> `UserBulkResult` is `{ created: number, errors: BulkCreateError[] }` where `BulkCreateError = { index, username?, email?, detail }`. `created` is a **count** (not user objects) — `UserListView` refetches the list after a (partial) success. `detail` is a specific message (e.g. `Email 'x@y.com' is already taken`) rendered in the bulk error panel as `Row N (email): detail`.

### UserFilters
`search?`, `role?`, `is_active?`, `page?`, `page_size?`

---

## Response envelopes (`src/types/api.ts`)

```ts
PaginatedResponse<T> = { items: T[], total: number, page: number, page_size: number, total_pages: number }
ApiResponse<T>       = { data: T, message?: string }
ErrorResponse        = { detail: string, status_code: number }
ValidationErrorResponse = { detail: ValidationError[] }
```

---

## Auth flow

1. POST `/auth/login` → receive `access_token` + `refresh_token`
2. Store both tokens in `localStorage` (keys: `access_token`, `refresh_token`)
3. All subsequent requests: `Authorization: Bearer <access_token>`
4. On 401: automatically POST `/auth/refresh` with `refresh_token` → get new tokens → retry original request
5. If refresh fails: clear tokens, redirect to `/login`
