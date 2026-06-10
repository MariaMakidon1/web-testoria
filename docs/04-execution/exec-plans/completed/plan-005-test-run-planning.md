# Execution Plan: 005 — Test Run Planning

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Improve test run planning UX: add a case-count preview when selecting a suite, validate that at least one case is selected before allowing submission, and expose `TestRunProgress` fields clearly in `TestRunDetailView`.

---

## Context

The feature is functionally complete. Analysis surfaced two UX gaps: (1) when a user selects a suite during run creation, there is no immediate feedback on how many test cases will be included; (2) the `TestRunProgress` type has seven fields (`total`, `passed`, `failed`, `blocked`, `skipped`, `untested`, `pass_rate`) but only `pass_rate` is displayed in the run list — the full breakdown is available but unused. Additionally, no client-side validation prevents submitting a run with zero test cases selected.

---

## Scope

### In scope
- Show case count preview when a suite is selected in `TestRunCreateView`
- Block form submission if `include_test_cases` is empty (client-side validation)
- Display full progress breakdown (passed / failed / blocked / skipped / untested) in `TestRunDetailView` alongside the progress bar

### Out of scope
- Cherry-picking individual test cases (currently suite-based selection only) — deferred
- Milestone linking UI improvements — separate milestone feature plan

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/TestRunCreateView.vue` | Derive case count from selected suite via `testCasesStore`; block submit when count is 0 |
| views | `src/views/TestRunDetailView.vue` | Add progress breakdown panel using `TestRunProgress` fields |
| tests | `tests/unit/stores/testRuns.spec.ts` | Extend — progress initialization, status transitions |

### Key decisions

- Case count preview is computed client-side from the `testCasesStore` filtered by `suite_id` — no extra API call needed if cases are already loaded for the project. If not loaded, show a loading state and fetch.
- Progress breakdown uses colour-coded count badges matching `RESULT_STATUS_COLORS` from `src/types/testResult.ts` for visual consistency with the execution view.

---

## Tasks

### Implementation
- [ ] Add case count preview to `TestRunCreateView` suite selector
- [ ] Add empty-selection validation to `TestRunCreateView` form submit
- [ ] Add full progress breakdown to `TestRunDetailView`
- [ ] Extend `testRuns` unit tests

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/005-test-run-planning.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Test cases for the selected suite may not be loaded yet | Medium | Trigger `testCasesStore.fetchTestCases` on suite selection; show count as "Loading…" until resolved |

---

## Definition of done

- [ ] Suite selection shows test case count immediately
- [ ] Submit is blocked with visible error when no cases are selected
- [ ] `TestRunDetailView` shows per-status counts alongside pass rate
- [ ] Unit tests passing
