# Tech Debt

Known issues and deferred improvements. Add items when debt is incurred, remove when resolved.

---

## Active items

### Forgot-password has no resend / rate-limit feedback (plan-097)
**Impact**: The forgot-password confirmation screen (`ForgotPasswordView.vue`) shows a static "check your inbox" message with no **Resend** control and no surfacing of any server-side rate limit. The requested email isn't remembered across the confirmation, so a user who mistyped it has to navigate back and retype. The backend's forgot-password rate limiting is itself tracked as tech debt in api-testoria plan 048; until that lands there's nothing for the UI to reflect.
**Fix**: Add a "Didn't get it? Resend" action (with a short client-side cooldown) that re-submits the same email; keep the entered email in component state so the confirmation can show it and the resend can reuse it. Once api 048 adds rate limiting, surface a `429`/Retry-After hint instead of the generic confirmation.

### Cross-parent drag-and-drop in the suite tree (plan-093 follow-up)
**Impact**: v1 of drag-and-drop reorder (plan-093) only handles **same-parent** drops — a section can be reordered among other top-level sections, a subsection among siblings of the same parent, and a case row among siblings in the same section. Moving a section under a different parent (re-parent) or dragging a case to a different section is silently rejected at the drop boundary; users still need the Edit dialog for those operations.
**Fix**: Extend `useTreeDnd` with an optional "drop-onto-row" mode (separate from drop-between-rows) that emits a re-parent intent; wire it into `TestSuiteTree` to flip `parent_suite_id` via `updateTestSuite` and into `TestCaseSection`'s section header to flip `suite_id` via `updateTestCase`. Backend already supports both (api plan-046 added the cycle check for the suite case). Worth pairing with a confirm step for moves that change suite scope, since downstream test runs may reference cases by suite.

### Order-rebalance helper when gap-based `display_order` collapses (plan-093 follow-up)
**Impact**: The drag-and-drop drop computes `new_order = floor((prev.display_order + next.display_order) / 2)`. After ~20 bisects in the same gap, the floor collapses to `prev + 1`; two more bisects collide. Collision is non-fatal (secondary `(created_at, id)` sort resolves it, no data loss) but further reorders on that pair lose visual effect.
**Fix**: Pair with api plan-046's matching tech-debt entry. When the FE detects a tight gap on a drop (e.g. `next - prev <= 1`), call a new `renumber_siblings` backend endpoint that bulk-reassigns `display_order` at `REORDER_GAP * index` across the sibling group, then refetch. Only worth shipping when a real workload starts hitting collisions.

### Multi-project Excel/PDF export from the Reports page (plan-082)
**Impact**: When the Reports page is in "All projects" mode the Export PDF / Export Excel buttons are disabled with a tooltip — `useExcelExport` and `usePdfExport` are built around a single project's test cases plus a single run's results, so cross-project data would silently produce a wrong export. Users who want a cross-project export today must flip back to a single project, export, then repeat.
**Fix**: Either extend the export composables to accept a multi-project payload (one sheet per project on Excel; one section per project on PDF), or generate one file per project concurrently and bundle them in a zip via `JSZip`. The runs dropdown already labels options with `<project_name> · <run_name>` so the per-run export flow can stay single-run; the gap is bulk export across projects.

### Swap suite-tree data source to `?group_by=suite` endpoint (plan-068 follow-up)
**Impact**: `SuiteTreeResults` groups cases client-side from `testResultsStore.runCases` + `testSuitesStore.suiteTree`. Api plan-034's `GET /test-runs/{id}/cases?group_by=suite` would provide pre-computed per-suite progress + grouping server-side, removing the client-side walk and matching the contract plan-068 was originally written against.
**Fix**: Once api plan-034 ships, add `getRunSuiteTree(runId)` in `src/api/testRuns.ts`, a `fetchSuiteTree` action on `testRunsStore`, and have `SuiteTreeResults` accept the pre-grouped shape as an alternative input. The client-side grouping path stays as a fallback while the endpoint rolls out.

### Bulk actions on suite-tree (plan-068 follow-up)
**Impact**: Users can't mark an entire suite's cases as passed/failed/blocked at once — they walk the tree one-by-one.
**Fix**: Add a suite-header action menu in `SuiteTreeBranch` (execute mode only) with "Mark all passed / failed / blocked / reset". Emit a new `bulk-execute(suiteId, verdict)` event; the execute view iterates `SuiteTreeResults.dfsCases()` over that subtree and submits in sequence.

### Virtual scroll SuiteTreeResults for very large runs (plan-068 follow-up)
**Impact**: Runs with thousands of cases render all DOM nodes at once. Scroll performance degrades on low-end hardware.
**Fix**: Plug in `@tanstack/vue-virtual` or similar for the flat-row portion inside each branch. Only worth doing when a customer crosses a few thousand cases — current cap is plan-033's 2000.

### Wire Centrifugo `TestRunStatusChanged` subscription (plan-070)
**Impact**: The plan-070 rename to `active` works end-to-end on its own, but a real-time refresh when a run transitions (someone else marks Completed, backend auto-flips on first result from another tab) still requires a page reload. The frontend has no WS infrastructure yet — plan-070 mentions a `useRealtimeRun` composable that doesn't exist.
**Fix**: Add a Centrifugo client (or whatever transport the API team settles on) with a single channel per run; subscribe on `TestRunDetailView` / `TestRunExecutionView`; dispatch `testRunsStore.setRunStatusOptimistic` (or replace with a full run fetch) on event. Also triggers `projectsStore.fetchBulkStats()` when a run transitions to `completed` so dashboard tiles refresh.

### Remove `in_progress` compat normaliser after one release (plan-070)
**Impact**: `src/api/testRuns.ts` normalises legacy `in_progress` wire values to canonical `active` at the adapter boundary. The conversion is defensive for the rollout window — once api plan-039 is deployed everywhere the API will only ever emit `active`.
**Fix**: After one release of the API rename, delete `normaliseRunStatus`, `normaliseRun`, and the `WireTestRunStatus` type; let API responses flow unchanged into the store.

### Unify comment-save flow between detail and execution views (plan-073)
**Impact**: `TestRunDetailView.handleUpdateComment` and `TestRunExecutionView.saveComment` both upload attachments and then call `updateResult`/`submitResult`, but with different orderings, toast wording, and orphan-attachment semantics. When one flow changes, the other drifts.
**Fix**: Extract a shared `useCommentSave(runId)` composable that owns the upload → update → refetch sequence, error toasting, and edit-mode preservation. Overlaps with plan-068's detail/execution unification.

### Global invalidation policy for test-cases / test-suites stores (plan-077)
**Impact**: `EditRunCasesDialog` now force-refetches on open via `refreshCasesBySuite`, but other callers of `fetchTestCasesBySuite` still rely on the per-suite cache. If another surface (e.g. test-case list) needs fresh data after an external mutation, it has to opt-in individually.
**Fix**: Pick a policy — either invalidate the `casesBySuite` cache on every mutating call (create/update/delete) across the store, or move to a query-cache library (TanStack Query / Pinia Colada) with TTL + refetch-on-focus semantics.

### Unify saveComment and submitResult payload builders (plan-072)
**Impact**: `TestRunExecutionView.saveComment` and `submitResult` build nearly-identical `TestResultCreate` payloads (comment, status, step_results, defects). They drifted once already (plan-072 caught the step_results omission); they will again.
**Fix**: Extract a `buildResultPayload(options)` helper that both call sites use. Low priority — already-flagged duplication, tests cover both paths.


### Collision-avoidance for doughnut leader-line labels (plan-078)
**Impact**: The dashboard's doughnut currently has ≤4 slices, so the minimal leader-line plugin in `DoughnutChart.vue` is fine. If a future caller uses more slices (or very small ones cluster), labels will overlap.
**Fix**: Switch to `chartjs-plugin-datalabels` or implement vertical staggering keyed off per-side label count. Only worth doing when a second caller with more slices appears.

### Token storage in localStorage (XSS risk)
**Impact**: If XSS is exploited, tokens can be stolen.
**Fix**: Evaluate migrating to HttpOnly cookies (requires backend changes). Current approach is documented as an intentional trade-off in `docs/05-quality/SECURITY.md`.

### Milestone list UI missing (plan-026)
**Impact**: Milestones have API, types, and store wiring but no list/detail view. Delete button from plan-026 could not be added because there is nothing to attach it to. Test runs can reference milestones but users cannot create, view, or remove them in the UI.
**Fix**: Add a milestone list section to `ProjectDetailView.vue` (or a dedicated view) that renders `milestonesStore.milestones`, then wire the existing `deleteMilestone` store action through a PrimeVue `useConfirm()` flow like other entities.

### Soft-delete UI (plan-026 Phase B)
**Impact**: Deleted state cannot be shown or restored from the frontend. Deletes are permanent from the user's perspective.
**Fix**: Once backend api-testoria plan-020 ships, implement Phase B of plan-026 — add `deleted_at` to entity types, restore actions, `include_deleted` list param, "Show deleted" toggles, visual indicators, and Restore buttons.

### Trash / recycle-bin view (plan-026 nice-to-have)
**Impact**: No dedicated place to review recently deleted items across entity types.
**Fix**: After Phase B lands, consider a single "Trash" view that lists soft-deleted items from all domains with one-click restore.

### Status color duplication across four sources (plan-048)
**Impact**: Result status colors are defined in four places (CSS vars, TS constant, PDF RGB tuples, Excel ARGB hex). Changing a color requires updating all four in lockstep.
**Fix**: Extract a single `status-colors.ts` module that exports hex, RGB, and ARGB formats from one definition. CSS vars can reference the hex via a build-time plugin or remain as the fifth source if the module generates a CSS snippet.

### Proper CSV parsing for bulk user create (plan-051)
**Impact**: The bulk-create parser uses naive `split(",")` — commas inside field values (e.g. names like "Doe, Jr.") break the parse silently.
**Fix**: Implement header-row-aware CSV parsing with quoted-value support, or switch to a file-upload flow with a proper CSV library.


### Align all verdict buttons to status tokens (plan-057)
**Impact**: `/test-runs/:id/execute` now reads `--status-blocked` for the Blocked button (plan-057), but Passed/Failed/No Run still lean on PrimeVue severities (`success`, `danger`, `secondary`). If the PrimeVue theme shifts or the status tokens are re-themed, the buttons will drift again.
**Fix**: Replace the remaining `severity` props with scoped classes reading the matching `--status-*` token.

### Harmonise test-case detail route to be project-scoped (plan-056)
**Impact**: `/test-cases/:id` omits the project segment while `/projects/:projectId/test-cases` includes it. The project switcher's redirect table has to special-case both shapes.
**Fix**: Migrate `/test-cases/:id` → `/projects/:projectId/test-cases/:id`; update all links and `router-link`s; simplify `redirectTargetForSwitch`.

### Pagination for runs with > 500 cases (plan-055)
**Impact**: `GET /test-runs/:id/cases` is capped server-side at 500 cases. Runs with more are silently truncated in `TestRunDetailView`.
**Fix**: Add pagination/infinite-scroll to the detail-page list once backend raises the cap or supports `page`/`page_size` on the endpoint.

### Execution view shares data source with detail view (plan-055)
**Impact**: `TestRunExecutionView` still maintains its own case list and results store flow. Migrating it to consume `fetchRunCasesWithResults` would unify the synthesised `no_run` row handling and simplify the store.
**Fix**: Route the execution view through the same action, remove its bespoke case-fetching path.

### Edit test run case set (plan-045)
**Impact**: A test run's case list is fixed at creation. There is no way to add or remove cases from an existing run in the UI — or via the backend — once it has been created.
**Fix**: Needs `PUT /test-runs/{id}/cases` from backend plan-025. Once that endpoint ships, add an "Edit cases" flow to `TestRunDetailView` that reuses `TestSuiteTreeSelector` with the run's current case IDs pre-populated as the initial selection.

---

## Resolved

### Bulk Create still required a per-row password (plan-097) — **Resolved 2026-06-03**
Closed by plan-098 / api 049. Creation is now **invite-only** end-to-end: `password` was removed from the `UserCreate` type, the Create-User form, and the Bulk Create CSV (now `username,email,full_name,role`). Every new account — single or bulk — is onboarded via the welcome set-password email link; no password is ever entered by staff. (Proper quoted-CSV parsing for bulk create remains a separate open item below — naive `split(",")` is unchanged.)

### This repo owned the shared edge proxy + TLS for api/s3 (plan-096) — **Resolved 2026-06-01**
The dockerized edge (`proxy/nginx.conf` + `nginx-proxy`/`certbot` in `docker-compose.prod.yml`) that terminated TLS and routed `api.*`/`s3.*`, and the `testoria-proxy` docker network this repo *created*, all lived here. Plan-096 (web slice of api plan 047) moved the edge to host-level nginx; this repo now ships only `deploy/web.vhost.conf` for `testoria.*` and serves the SPA as static files from disk. The cross-repo proxy coupling and docker-network bootstrap ordering are gone. **New debt:** deploy now requires scoped passwordless sudo on the host (write `/etc/nginx`, reload nginx, manage `/var/www/testoria`) — see `api-testoria/deploy/README.md`.

### Convert pass-rate ratio → percent at API-adapter layer (plan-076) — **Resolved 2026-05-08**
The render-site cleanup landed in plan-083 — every percent value now flows through `formatPassRate` (string) or `toPercentRounded` (number). The `ProjectDetailView.vue:179` legacy bug that displayed the raw 0..1 ratio as `0.875%` is fixed in the same pass. The `> 1.5` clamp in `toPercent` is intentionally kept as a defensive shim until api plan 035 + api plan 044 have both been live for ≥ 2 weeks (a follow-up plan removes it).

### Migrate remaining pass-rate sites to `formatPassRate` (plan-058) — **Resolved 2026-05-08**
Closed by plan-083. `DashboardView.vue`, `TestRunListView.vue`, `ReportDashboardView.vue`, `useExcelExport.ts`, and `usePdfExport.ts` all route through the helper. Excel exports now store the raw ratio with `numFmt: '0.0%'` so users get sort-by-rate for free. Backend pair: api plan 044 rounds at the response boundary so the wire value is the source of truth.

### Bulk project stats endpoint — **Resolved 2026-04-17**
The home dashboard used to fan out `testRunsStore.fetchAllRuns(projectIds)` + `testCasesStore.fetchAllCases(projectIds)` across every active project just to compute per-project pass rates and total counts client-side via `aggregatePassRatesByProject`. Backend plan-028 added `GET /projects/stats` returning per-project counts and pass rate in a single round-trip; frontend plan-053 wired `DashboardView` to consume it via `projectsStore.fetchBulkStats`. The `fetchAllCases` fanout is gone; runs are still fetched for the trend/doughnut/recent-runs charts (which need row-level data).

### Reports page N+1 fetch pattern — **Resolved 2026-04-17**
`ReportDashboardView.vue` looped `testResultsStore.fetchResults(run.id)` once per run to compute status counts and pass rate for the charts — 20+ sequential round-trips per project, each transferring the full result payload (`step_results`, `stack_trace`, `defects`). Replaced with a single `GET /projects/:id/report-analytics` call via the new `reports` store. The view now drives every chart from `reportsStore.analytics`; exports lazy-load their heavier payloads on click only. Closed in plan-052 (paired with backend plan-027).

### No 404 catch-all route — **Resolved 2026-03-23**
Added `NotFoundView.vue` and `{ path: '/:pathMatch(.*)*', name: 'NotFound' }` route.

### No unit tests written — **Resolved 2026-03-23**
Added `tests/unit/stores/auth.spec.ts`, `testCases.spec.ts`, `testRuns.spec.ts` and `tests/unit/composables/useImport.spec.ts`.

### No e2e tests written — **Resolved 2026-03-23**
Added Playwright config and `tests/e2e/login.spec.ts`, `test-runs.spec.ts`, `test-execution.spec.ts`.

### `npm audit` not in CI — **Resolved 2026-03-23**
Added `npm audit --audit-level=high` step to `.github/workflows/ci.yml`.

### Mock layer removed — **Resolved 2026-04-06**
Deleted entire `src/mock/` directory, removed `MOCK_ENABLED` guards from all API files, removed localStorage fallback patterns from stores. All API calls now go directly to the real backend.

### No debounce on filter inputs — **Resolved 2026-03-23**
Added 300ms debounce on the `filter` event in `FilterPanel.vue` using `lodash-es/debounce`.

### Concurrent 401 refresh calls not deduplicated — **Resolved 2026-03-23**
Refactored `api/client.ts` to use a module-level `refreshPromise` shared across all concurrent 401 retries.

### No Lighthouse CI — **Resolved 2026-03-23**
Added `@lhci/cli` step to CI and `.lighthouserc.json` with minimum score thresholds.

### Monolithic CI/CD workflow, missing PR validation and deploy hardening — **Resolved 2026-03-24**
Split `ci-cd.yml` into `ci.yml` (runs on PRs) and `cd.yml` (runs after CI on main). Added: Playwright e2e in CI, Docker layer caching via GHCR, GH_PAT credential helper (no token in URLs), concurrency guard on deploy, post-deploy health check.
