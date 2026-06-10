# Execution Plan: API Integration — Reports, Dashboard & Analytics

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Align reporting endpoints with backend and add missing report features.

---

## Tasks

### Implementation
- [x] Update `src/types/report.ts` — `DashboardData` added `total_test_suites`, `pass_rate`; `status_distribution` uses `Record<string, number>`; added `CustomReportRequest`, `CustomReportResponse`, `CustomReportItem`
- [x] Fix `getTestRunMetrics` path → `/test-runs/{id}/report?format=json`
- [x] Fix `getProjectMetrics` → `days` param instead of `start_date`/`end_date`
- [x] Add `getCustomReport(filters)` function
- [x] Dashboard view already computes client-side — no changes needed

### Quality check (Phase 4)
- [x] `npm run build` passes
- [x] `npm run test -- --run` passes (281/281)

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated
- [x] This plan moved from `active/` to `completed/`

---

## Definition of done

- [x] All report endpoints use correct backend paths and params
- [x] Custom report endpoint wired
- [x] Unit tests pass
