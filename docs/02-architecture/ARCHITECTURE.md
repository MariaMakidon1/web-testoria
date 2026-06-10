# ARCHITECTURE — Testoria Web Frontend

## What this is

Testoria is a **test management SPA**: teams use it to organize test cases into suites, plan and execute test runs, record pass/fail results per test case, track defects, and generate reports. The backend is a separate service; this repo is the Vue 3 frontend only.

The single most important concept to keep in mind: a **TestCase** is a reusable specification; a **TestResult** is one execution of a TestCase within a specific **TestRun**. Everything in the UI revolves around navigating that hierarchy — Projects → Test Suites/Cases → Test Runs → Test Results.

---

## Codemap

```
src/
├── api/          — HTTP boundary. One file per domain. All real network calls live here.
│   └── client    — Axios instance: attaches Bearer token, handles 401 → token refresh → retry
├── stores/       — Pinia stores. One per domain. The only place that holds shared state.
│   ├── auth      — JWT tokens, current user, role-derived permission flags;
│   │               also pre-auth password recovery (forgotPassword, resetPassword,
│   │               validateResetToken) backing the public forgot/reset/set screens
│   │               with loading/error state (plan-097)
│   ├── users     — Admin user management (list, CRUD, bulk create, export)
│   ├── testCases — Test case list, current test case, pagination, filters;
│   │               also casesBySuite cache (Map<suiteId, TestCase[]>) populated by
│   │               fetchTestCasesBySuite for lazy suite tree loading (plan-045);
│   │               reorderTestCase(id, suiteId, newDisplayOrder) — optimistic
│   │               drag-reorder with rollback across all cached lists (plan-093)
│   ├── ui        — Sidebar open/closed, active modal — no business logic
│   └── preferences — Theme (light/dark), persistent UI settings
├── types/        — TypeScript interfaces and enums. No logic, no imports from other src/ layers.
│   └── api       — ApiResponse, PaginatedResponse, ErrorResponse — shared envelope types
├── composables/  — Reusable logic that doesn't need to be a store (useExport, useImport,
│                   useBulkOperations, useExcelExport, usePdfExport, useAccessibility)
├── router/
│   └── index     — All routes + navigation guard (auth check + lazy user fetch)
├── views/        — One component per route. Thin: load data via store, delegate UI to components.
├── components/
│   ├── common/   — Shared components used across features
│   └── <domain>/ — Feature-specific components (test-cases/, test-runs/)
└── layouts/      — DefaultLayout (sidebar + header) wraps all authenticated views
```

**"Where is the thing that does X?"**

| X | Look here |
|---|---|
| Auth token lifecycle, role checks | `stores/auth` |
| Password recovery / set-password (invite) | `stores/auth` (`forgotPassword`, `resetPassword`, `validateResetToken`), `api/auth`, `views/auth/ForgotPasswordView`, `views/auth/ResetPasswordView` (shared by `/reset-password` + `/set-password`) — plan-097 / api 048 |
| User management (admin) | `stores/users`, `api/users`, `views/users/` |
| API request/response shaping | `api/<domain>` + `types/api` |
| Token attach / 401 refresh | `api/client` |
| Route protection | `router/index` navigation guard |
| Bulk select / bulk delete | `composables/useBulkOperations` |
| Excel / PDF export | `composables/useExcelExport`, `composables/usePdfExport` |
| CSV/Excel import | `composables/useImport` |
| Rich text (test case descriptions, steps) | `components/common/RichTextEditor` (Tiptap) |
| Test step authoring UI | `components/test-cases/TestStepsEditor` |
| Suite tree navigation | `components/test-cases/TestSuiteTree`, `TestCaseTreeView` |
| Suite-level case selection (test run create) | `components/test-cases/TestSuiteTreeSelector`, `composables/useSuiteSelection` |
| Drag-and-drop reorder (sections, subsections, cases — same-parent only) | `composables/useTreeDnd` (gap-based `display_order` math + same-scope guard), wired into `components/test-cases/TestSuiteTree` and `TestCaseSection`; store actions `testSuitesStore.reorderTestSuite`, `testCasesStore.reorderTestCase` — plan-093 / api plan-046 |
| Create-Test-Run wizard block when project has no cases | `views/test-runs/TestRunCreateView` step 2: `projectHasNoCases` computed disables `create-skip-cases-btn` + `create-next-btn` and adapts the empty-state copy (plan-092) |
| Add Section affordance in empty state | `components/test-cases/TestCaseTreeView` empty-state branches on `hasAnySuites`; sidebar header carries a labelled `Add Section` button (`[data-testid="add-section-btn"]`); in-section row uses Buttons not text-links (plan-094) |
| Priority chip (single source) | `<Tag :value="PRIORITY_LABELS[priority]" :severity="getPrioritySeverity(priority)">` on every surface; helper in `types/testCase.ts` (plan-095) |
| Run progress bar (segmented) | `components/test-runs/TestRunProgressBar` |
| Run execution (recording results) | `views/test-runs/TestRunExecutionView` |
| Per-step status picker (execution) | `components/test-runs/StepStatusPicker`, `composables/useOverallStatusSuggestion` |
| Defect tracking panel | `components/test-runs/DefectsPanel` |
| Edit / archive project (name, description, `is_archived`) | `components/projects/EditProjectDialog` opened from both `views/projects/ProjectListView` (per-row pencil) and `views/projects/ProjectDetailView` (header **Edit** button, lead+); wired to `stores/projects.updateProject` (plan-091) |
| Delete project (cascade-warning) | `views/projects/ProjectListView` per-row trash (admin) and `views/projects/ProjectDetailView` header **Delete** (admin) both use PrimeVue `useConfirm()` → `stores/projects.deleteProject`; detail-page Delete navigates to `/projects` on success (plan-091) |
| Edit test run metadata (name, config) | `components/test-runs/EditTestRunDialog` opened from `views/test-runs/TestRunDetailView`, wired to `stores/testRuns.updateTestRun` |
| Edit test run's case list (replace) | `components/test-runs/EditRunCasesDialog` wraps `TestSuiteTreeSelector`, opened from `TestRunDetailView`, wired to `stores/testRuns.setRunCases` |
| Run result list grouped by suite (detail + execute) | `components/test-runs/TestResultsList` (detail header/filter/empty-state) + shared `components/test-runs/SuiteTreeResults` (via recursive `SuiteTreeBranch`) — driven by a `mode: "read" \| "execute"` prop; collapse state persists in `localStorage` under `testoria.suiteTree.collapsed[runId]` |
| Run cases + synthesised `no_run` rows | `stores/testResults` → `fetchRunCasesWithResults(runId)` exposes `results` + `runCases: TestCaseWithResult[]` |
| Sidebar / modal visibility | `stores/ui` |
| Theme / display preferences | `stores/preferences` |
| Tag search/create, tag filter | `stores/tags`, `api/tags` |
| Saved filter sets | `stores/savedFilters` |
| Result status change history | `stores/testResults` → `fetchHistory()`, `api/testResults` → `getTestResultHistory()` |
| Keyboard shortcuts (app-wide) | `composables/useAccessibility` → `useKeyboardShortcuts()`, `components/common/KeyboardShortcutsDialog` |
| Dashboard pass-rate aggregation | `composables/usePassRateAggregation` |
| Reports dashboard aggregated analytics (per-project) | `stores/reports` → `fetchReportAnalytics()`, `api/reports` → `getProjectReportAnalytics()` |
| Reports dashboard aggregated analytics (all-projects) | `stores/reports` → `fetchCrossProjectReportAnalytics()` (separate `crossProjectAnalytics` slot), `api/reports` → `getCrossProjectReportAnalytics()`, `components/reports/PerProjectBreakdown.vue` |
| Pass-rate / percent formatting (1-decimal everywhere) | `utils/passRate` → `formatPassRate()` (string), `toPercentRounded()` (number), `toPercent()` (raw — for mean inputs) — plan-083 |

---

## Layer boundaries

```
Views / Components
      |  (read/write via store actions and getters only)
      v
   Stores
      |  (call api functions, never apiClient directly)
      v
   api/<domain>
      |
      v
   api/client  (Axios, real network)
```

**Stores are the only consumers of `api/`**. Views and components never import from `api/` directly — they go through a store. This keeps data-fetching logic and caching in one place and keeps components testable without network stubs.

**`types/` has no runtime dependencies**. Nothing in `src/types/` imports from stores, api, composables, or components. Types flow one-way: everything else imports from `types/`, never the reverse.

**`api/client` is the only place that touches `localStorage` for tokens** (reads `access_token` on every request, writes/clears both tokens on refresh). `stores/auth` also reads/writes localStorage for tokens on login/logout — this is intentional duplication so the store and the Axios interceptor stay independent. Do not move token storage elsewhere.

---

## Architectural invariants

- **No component imports from `api/`**. If you need data in a component, there is a store for it.
- **No store imports another store's internal state directly** (use the composable-store pattern if cross-store reads are needed).
- **All API calls go through `api/<domain>` functions**. No direct `apiClient` usage outside `api/`.
- **All routes except `/login` carry `meta: { requiresAuth: true }`**. The navigation guard in `router/index` enforces this. Never add an authenticated route without that meta flag.
- **Role enforcement lives in `stores/auth`** via computed flags (`isAdmin`, `isProjectManager`, `canManageTests`, `canManageUsers`). Components read these flags — they do not inspect `user.role` directly. (`canManageUsers` = Lead or Admin, gating user management; Admin-only sub-actions like managing Admins still read `isAdmin` — plan-098.)
- **UI-only state belongs in `stores/ui`**, not in feature stores. Feature stores should contain no knowledge of whether a modal is open or the sidebar is visible.

---

## Key types (use symbol search to find them)

- `TestCase`, `TestStep`, `TestCaseCreate`, `TestCaseUpdate` — core test case model. `Priority`: `critical|high|medium|low`. `TestCaseType`: `manual|automated`. `TestCaseStatus`: `draft|active|deprecated`
- `TestRun`, `TestRunStatus`, `TestRunProgress` — a planned execution of a set of test cases. Status: `planned|in_progress|completed|aborted`. Progress shape: `{ total, passed, failed, blocked, no_run, pass_rate }`. Any legacy `untested` field on incoming payloads is folded into `no_run` by `updateTestRunProgress` — the frontend tracks a single "not run" bucket.
- `Milestone` — time-boxed release marker. `is_completed` boolean, `target_date`
- `TestResult`, `ResultStatus` — one execution record linking a TestCase to a TestRun. Status: `passed|failed|blocked|no_run`. Every case in a run has a displayed row (synthesised client-side when no real TestResult exists yet, carrying `id: null` + `status: "no_run"`).
- `TestResultHistory` — immutable audit entry for each status change on a TestResult
- `Defect`, `Attachment` — attached to TestResult
- `TestSuite` — hierarchical grouping of TestCases within a project
- `SavedFilter` — named filter preset scoped to a view context, persisted in localStorage
- `DashboardData`, `ProjectMetrics`, `TestRunMetrics`, `TrendData` — legacy report types (home dashboard + per-run report)
- `ProjectReportAnalytics`, `RunAnalyticsItem`, `TestCaseDistribution`, `TrendPoint`, `ReportAnalyticsSummary`, `ReportAnalyticsParams` — shape of the aggregated Reports & Analytics endpoint (`GET /projects/:id/report-analytics`)
- `User`, `UserRole` — auth model; `UserRole` drives all permission checks
- `ForgotPasswordRequest`, `ResetPasswordRequest`, `ResetTokenValidateResponse` — password recovery / set-password DTOs (plan-097)
- `UserCreate`, `UserUpdate`, `UserBulkCreate`, `UserBulkResult` — admin user management types (`UserCreate.password` is optional — omit for the welcome-invite flow)
- `PaginatedResponse<T>`, `ApiResponse<T>` — standard response envelopes for all list/detail endpoints

---

## Production deployment

The public edge is **host-level nginx + system certbot** (not containerized). This repo is no longer involved in the edge: CI builds the static `dist/` bundle and ships it to the host, where host nginx serves it from `/var/www/testoria/current` via `deploy/web.vhost.conf` (mounted to `/etc/nginx/sites-available/`). There is no web container, no `nginx.conf`, and no `proxy/` directory anymore — the gzip / asset-cache / security-header rules from the former inner `nginx.conf` now live in `deploy/web.vhost.conf`. See `api-testoria/deploy/README.md` for the host runbook and `plan-096` / api `plan 047` for the migration.

Host nginx fronts three public hostnames, each owned by the repo that serves it, each with its own Let's Encrypt cert:

| Hostname | Backend | Owning repo / vhost |
|---|---|---|
| `testoria.gammait.net` | `/var/www/testoria/current` (SPA files on disk) | web-testoria — `deploy/web.vhost.conf` |
| `api.testoria.gammait.net` | `127.0.0.1:8000` (api container) | api-testoria — `deploy/api.vhost.conf` |
| `s3.testoria.gammait.net` | `127.0.0.1:9000` (minio container) | api-testoria — `deploy/api.vhost.conf` |

The api and minio containers are published on `127.0.0.1` only (loopback), so host nginx is the sole public listener. The s3 vhost (in api-testoria) must keep `proxy_set_header Host $host;` or SigV4 verification on presigned attachment URLs fails. Per-app certs are renewed by the system `certbot.timer`; each repo's CI installs its own vhost and runs `nginx -t && systemctl reload nginx`. The old shared `testoria-proxy` docker network and the `resolver` startup hack are retired.
