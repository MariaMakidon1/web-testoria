# Execution Plan: API Integration — Test Runs & Milestones

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Align test run and milestone types with backend, add missing endpoints, and implement milestone CRUD.

---

## Tasks

### Implementation — Test Runs
- [x] Update `TestRunStatus` → `'planned' | 'in_progress' | 'completed' | 'aborted'`
- [x] Remove `description` and `created_by` from `TestRun` type
- [x] Add `getTestRunProgress(id)` and `getTestRunCases(id)` to API
- [x] Remove `getAllTestRuns()` (cross-project) — not in backend
- [x] Add `RUN_STATUS_LABELS` display map
- [x] Update StatusBadge run colors to lowercase with `planned`/`in_progress`
- [x] Update all views: DashboardView, ReportDashboardView, TestRunExecutionView, TestRunListView, TestRunDetailView, TestRunCreateView
- [x] Remove `description` from TestRunCreate/Update forms

### Implementation — Milestones
- [x] Update `src/types/milestone.ts` — `target_date`, `is_completed` boolean, removed `MilestoneStatus`/`MilestoneProgress`
- [x] Create `src/api/milestones.ts` with CRUD endpoints
- [x] Create `src/stores/milestones.ts`

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (282/282)
- [x] `npm run build` passes

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated (test runs + milestones sections)
- [x] `docs/02-architecture/ARCHITECTURE.md` codemap updated
- [x] This plan moved from `active/` to `completed/`

---

## Definition of done

- [x] Test run types match backend exactly
- [x] Progress and cases endpoints wired
- [x] Milestone CRUD works against real backend
- [x] Status values are consistent throughout UI
- [x] Unit tests pass
