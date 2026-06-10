# Execution Plan: Reports & Analytics N+1 Removal

**Date**: 2026-04-17
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Rewrite the Reports & Analytics page to load its entire dataset from a single aggregated backend endpoint instead of looping `testResultsStore.fetchResults(runId)` once per test run.

---

## Context

`src/views/reports/ReportDashboardView.vue` currently calls `testResultsStore.fetchResults(run.id)` in a `for` loop (around lines 426–428) after fetching the project's runs. Each iteration hits `GET /api/v1/test-runs/{id}/results` and returns the full result payload (with `step_results`, `stack_trace`, `defects`) only to compute status counts and pass rate. With 20+ runs this means 20+ sequential round-trips and wasted bandwidth.

The backend counterpart plan — `api-testoria/docs/04-execution/exec-plans/active/plan-027-reports-analytics-aggregated-endpoint.md` — exposes `GET /projects/{project_id}/report-analytics` that returns, in one response, the pre-aggregated data the page needs: project summary, per-run status counts, test case distributions (priority/type/automation), and the time-series trend.

This plan wires that endpoint into the frontend, deletes the client-side aggregation, and removes the in-page loop.

---

## Scope

### In scope
- New TypeScript types matching the backend response: `ProjectReportAnalytics`, `RunAnalyticsItem`, `TestCaseDistribution`, `TrendPoint`
- New function in `src/api/reports.ts`: `getProjectReportAnalytics(projectId, params)` calling `GET /projects/:id/report-analytics`
- New action in `src/stores/reports.ts` (create the store if it doesn't exist; otherwise extend): `fetchReportAnalytics(projectId, params)` + state `{ analytics, loading, error }`
- Refactor `ReportDashboardView.vue`:
  - Remove the `for (const run of runs)` loop around lines 413–439
  - Remove direct calls to `testResultsStore.fetchResults`, `testRunsStore.fetchTestRuns`, `testCasesStore.fetchTestCases` for the Reports use case
  - Drive all computed chart data off `reportsStore.analytics`
  - Keep the same visible charts (trend line, priority bar, type bar, automation doughnut, recent-runs list)
  - Pass `date_from` / `date_to` from the existing date-range picker as query params
- Unit tests for the new store action (mocked axios)
- E2E happy-path smoke for the Reports page (project selected → charts render with one API call)

### Out of scope
- Visual redesign of the Reports page — charts and layout stay the same
- Changing what other views (TestRun details, Test Results list) fetch — they still use `testResultsStore.fetchResults` directly
- Adding new filters beyond what the page already exposes (run status, milestone, assignee filters are tracked separately)
- Caching or request deduplication beyond what Pinia already gives us
- Backend changes (see `api-testoria` plan-027)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/report.ts` | Add `ProjectReportAnalytics`, `RunAnalyticsItem`, `TestCaseDistribution`, `TrendPoint` |
| api | `src/api/reports.ts` | Add `getProjectReportAnalytics(projectId, { dateFrom, dateTo, runStatus, includeTrend })` |
| store | `src/stores/reports.ts` (new or extended) | Add `analytics`, `loading`, `error` state and `fetchReportAnalytics(...)` action |
| views | `src/views/reports/ReportDashboardView.vue` | Delete per-run loop; switch computeds to consume `reportsStore.analytics`; single call on mount + on filter change |
| tests | `src/stores/__tests__/reports.spec.ts` | Unit test for the new store action |
| tests | `e2e/reports.spec.ts` (if present, or add) | Smoke: selecting a project triggers exactly one request matching `/report-analytics` |

### Key decisions

- **Invariant respected**: the view imports from the store, never from `src/api/`. The API module is only called from the store.
- **Single source of truth**: all chart computed props read from `reportsStore.analytics`. No more fan-out across `testRunsStore`, `testCasesStore`, `testResultsStore` for the Reports page.
- **Leave other stores untouched**: `testResultsStore.fetchResults` still exists and is used elsewhere — do not remove it. Only stop calling it from the Reports view.
- **Date range → query params**: the existing `trendDateRange` two-picker state maps to `date_from` / `date_to` ISO strings. Debounce the refetch on date change (200 ms) to avoid thrashing while the user drags.
- **Loading UX**: show a single page-level skeleton while `reportsStore.loading === true`, not one per chart. No partial states to manage.
- **Empty project**: backend returns an empty `runs` array and zero distributions. View renders "No data yet" per chart — add this before removing the old code path so the empty state is testable.
- **Error path**: if `getProjectReportAnalytics` fails, surface a single toast via the existing `stores/ui` notifications pattern; do not fall back to per-run fetching.

---

## Tasks

### Implementation
- [x] Define types in `src/types/report.ts` matching the backend response exactly
- [x] Add `getProjectReportAnalytics` in `src/api/reports.ts`
- [x] Add/extend `src/stores/reports.ts` with `analytics` state and `fetchReportAnalytics` action
- [x] Refactor `ReportDashboardView.vue`:
  - [x] Replace `loadMetrics()` body with a single `reportsStore.fetchReportAnalytics(...)` call
  - [x] Delete the `for (const run of runs)` loop
  - [x] Rewire `trendChartData`, `priorityChartData`, `typeChartData`, `automationChartData`, and recent-runs computeds to read from `reportsStore.analytics`
  - [x] Wire `trendDateRange` watcher to refetch with debounced query params
  - [x] Add empty-state rendering per chart
- [x] Remove any now-unused imports / code paths in the view
- [x] Write unit test for `fetchReportAnalytics` action (success + error)
- [x] Write e2e smoke test for the Reports page (one network call, charts present)

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] Network tab in DevTools shows exactly one `/report-analytics` request on page load (not N per run)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated with the new `getProjectReportAnalytics` entry
- [x] `docs/01-product/features/010-reports-dashboard.md` — update data-flow section to describe the single aggregated call
- [x] `docs/02-architecture/ARCHITECTURE.md` — update the "Where is X?" row for reports if the store structure changes
- [x] `docs/08-decisions/changelog.md` — add entry for the N+1 removal decision
- [x] `docs/04-execution/tech-debt.md` — add resolved entry for the Reports N+1 pattern
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend endpoint not yet deployed when frontend PR merges | High | Gate behind an env flag or merge after backend plan-027 is in staging; add a smoke test against staging before prod deploy |
| Response shape drifts from what the view expects | Medium | Share a single type contract (derive frontend types from backend schema); integration test hits the real backend in CI |
| Removing the per-run loop breaks a subtle dependency on `testRunsStore`/`testCasesStore` state elsewhere | Low | Grep for readers of that state; confirm nothing else relies on the Reports page pre-populating them |
| Charts render empty on first paint because store is empty | Medium | Show a skeleton while `loading === true`; ensure the fetch fires on component mount, not on first filter interaction |
| Large project payload (>1 MB) slows render | Low | Defer chart render until data is parsed; revisit with pagination/virtualization if real projects hit this |

---

## Definition of done

- [x] Feature works end-to-end against real backend
- [x] Reports page issues exactly one request to `/report-analytics` on load and on filter change (verified manually and in e2e)
- [x] All four charts + recent-runs list render correctly with the new data source
- [x] Empty project state renders without errors
- [x] Unit tests written and passing
- [x] PR checklist completed
- [x] Docs updated
