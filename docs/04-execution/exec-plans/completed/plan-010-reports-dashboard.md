# Execution Plan: 010 — Reports Dashboard

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Type `getProjectMetrics` properly, wire the trend line chart to real data from `getProjectMetrics`, and add a date range picker to scope the metrics query.

---

## Context

`getProjectMetrics(projectId, startDate?, endDate?)` exists in `src/api/reports.ts` but returns `Promise<any>` — the response shape is untyped. The `TrendData` and `ProjectMetrics` types in `src/types/report.ts` exist but are not used as the return type. Additionally, the trend line chart in `ReportDashboardView` likely relies on mock data rather than being wired to `getProjectMetrics`. A date range input for scoping metrics is not yet present in the UI.

---

## Scope

### In scope
- Define a typed `ProjectMetricsResponse` interface that wraps `TrendData[]` and `ProjectMetrics` (or confirm the existing types cover it)
- Change `getProjectMetrics` return type from `any` to the proper interface
- Wire the trend chart in `ReportDashboardView` to call `getProjectMetrics` and map response to Chart.js datasets
- Add a date range picker (PrimeVue `DatePicker` or `Calendar`) to the dashboard that passes `startDate`/`endDate` to the query

### Out of scope
- Per-suite breakdown chart (deferred)
- Scheduled/automated report delivery (backend concern)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/report.ts` | Add or confirm `ProjectMetricsResponse` interface; verify `TrendData` and `ProjectMetrics` shapes match backend |
| api | `src/api/reports.ts` | Change `getProjectMetrics` return type from `any` to `ProjectMetricsResponse` |
| mock | `src/mock/api/reports.mock.ts` | Update `mockGetProjectMetrics` to return typed mock data |
| views | `src/views/ReportDashboardView.vue` | Wire trend chart to `getProjectMetrics` data; add date range picker |

### Key decisions

- Date range defaults to the last 30 days on initial load.
- Date range change triggers a fresh `getProjectMetrics` call (not cached) — report data is intentionally not real-time but is fresh on each explicit query.
- Chart.js dataset mapping is done in the view (not in the store or API layer) — the transformation is display-specific and doesn't belong in the data layer.

---

## Tasks

### Implementation
- [ ] Define/confirm `ProjectMetricsResponse` type in `src/types/report.ts`
- [ ] Update `getProjectMetrics` return type in `src/api/reports.ts`
- [ ] Update mock to return typed data
- [ ] Wire trend chart in `ReportDashboardView` to `getProjectMetrics`
- [ ] Add date range picker to `ReportDashboardView`

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (no more `any` escape hatches)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/06-generated/api-schema.md` updated (typed response shape)
- [ ] `docs/01-product/features/010-reports-dashboard.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend response shape for `/projects/:id/metrics` does not match existing `TrendData`/`ProjectMetrics` types | Medium | Treat the types as a target — align with backend during integration; mock is authoritative until then |
| Chart.js requires specific dataset format — mapping may require non-trivial transform | Low | Map in a `computed` property in the view; unit test the transform separately |

---

## Definition of done

- [ ] `getProjectMetrics` is fully typed (no `any`)
- [ ] Trend chart renders data from `getProjectMetrics` in mock mode
- [ ] Date range picker filters the metrics query
- [ ] TypeScript build passes with no type errors related to reports
