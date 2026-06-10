# Execution Plan: Dashboard Bulk Project Stats

**Date**: 2026-04-17
**Author**:
**Status**: Completed

---

## Goal

Wire the home `DashboardView` to consume `GET /projects/stats` so the Overall Pass Rate card and the metrics headline no longer require a per-project fan-out of `fetchAllRuns` + `fetchAllCases`.

---

## Context

`DashboardView.vue` called `testRunsStore.fetchAllRuns(projectIds)` **and** `testCasesStore.fetchAllCases(projectIds)` across every active project, then passed the in-memory arrays through `composables/usePassRateAggregation` to compute a single headline number. `fetchAllCases` pulled every test case payload purely to count rows — the signal-to-noise ratio of that fetch was near zero.

Backend `plan-028-bulk-project-stats-endpoint` added `GET /projects/stats` returning per-project counts and pass rate in a single round-trip. This plan wires the frontend to use it.

---

## Scope

### In scope

- New frontend types in `src/types/project.ts`: `ProjectStatsItem`, `ProjectStatsBulkResponse`, `ProjectStatsBulkParams`
- New API function `getProjectStatsBulk(params)` in `src/api/projects.ts` (serializes `project_ids` as repeated params via `paramsSerializer: { indexes: null }`)
- New `projectsStore` state (`bulkStats`) and action (`fetchBulkStats(params)`)
- `DashboardView`:
  - Replace the client-side `aggregatePassRatesByProject` call with `scopedBulkStats` — a computed over `projectsStore.bulkStats`
  - `metrics.totalTestCases`, `totalTestRuns`, `activeRuns` all derive from bulk stats instead of the fanned-out caches
  - `passRateData.overall` and `passRateData.perProject` derive from bulk stats, preserving the equal-weight-per-project semantic
  - Drop `testCasesStore.fetchAllCases` from `loadDashboardData`
  - Drop the `useTestCasesStore` import entirely (not used anywhere else on the dashboard)
- Keep `testRunsStore.fetchAllRuns` (still required by the trend chart, results doughnut, and recent-runs list — those need row-level data not present in the bulk stats payload)
- Unit tests for the new `fetchBulkStats` store action

### Out of scope

- Replacing the trend / doughnut / recent-runs data sources — separate concern; they legitimately need run rows
- Caching or request deduplication beyond what Pinia already provides
- Visual changes to the dashboard

---

## Tasks

### Implementation
- [x] Add types in `src/types/project.ts`
- [x] Add `getProjectStatsBulk` in `src/api/projects.ts`
- [x] Add `bulkStats` / `fetchBulkStats` to `projectsStore`
- [x] Refactor `DashboardView`:
  - [x] `scopedBulkStats` computed
  - [x] `metrics` derives from bulk stats
  - [x] `passRateData` derives from bulk stats (equal-weight-per-project semantic preserved)
  - [x] Remove `fetchAllCases` + `useTestCasesStore`
  - [x] Keep `fetchAllRuns` for charts
- [x] Unit test for `fetchBulkStats` (success, params threading, error)

### Quality check
- [x] `npm run lint` — clean
- [x] `npm run test -- --run` — affected tests pass
- [x] `npm run build` — clean

### Docs update
- [x] `docs/06-generated/api-schema.md` — add `getProjectStatsBulk` row
- [x] `docs/08-decisions/changelog.md` — entry
- [x] `docs/04-execution/tech-debt.md` — move "Bulk project stats endpoint" from Active to Resolved

---

## Definition of done

- [x] Dashboard loads without calling `fetchAllCases`
- [x] Overall Pass Rate card and per-project breakdown populated from `/projects/stats`
- [x] Single-project scope: `fetchBulkStats({ project_ids: [selectedId] })` returns exactly one row and the UI mirrors the previous behaviour
- [x] All existing store tests still pass
