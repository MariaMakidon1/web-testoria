# Execution Plan: Test Run Create — Suite Tree Selection with Suite-Level Auto-Check

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Replace the flat DataTable + suite-dropdown case picker on the test run create page with a checkbox-enabled suite tree (mirroring the structure already used on `/projects/:id/test-cases`), where checking a suite auto-selects every test case under it (recursively), and the resulting selection is sent to the backend as an explicit `include_test_cases` list.

---

## Context

The project test cases page (`/projects/:id/test-cases`, `src/views/test-cases/TestCaseListView.vue:377–387`) already presents test suites as a tree via the reusable components `src/components/test-cases/TestCaseTreeView.vue` and `src/components/test-cases/TestSuiteTree.vue`. Users navigate the hierarchy left-to-right and see the cases for the selected suite — this is the established pattern.

The test run create view (`src/views/test-runs/TestRunCreateView.vue`) does not follow that pattern. It uses:
- A suite **dropdown filter** (lines ~378–386) — flat, single-suite at a time
- A **DataTable with checkboxes** (lines ~414–464) for case selection — row-by-row only

Two problems flow from this:
1. **Inconsistent UX** — users learn the suite tree on one page and lose it on another
2. **Tedious selection** — to add 30 cases from one suite, the user has to tick 30 boxes; there is no "select this whole suite"

The view already builds an `include_test_cases: number[]` array (line ~235) and passes it to `testRunsStore.createTestRun(...)`. The backend, however, currently drops that field — see companion plan `api-testoria/docs/04-execution/exec-plans/active/025-be-test-run-explicit-case-selection.md`, which adds an association table and honors `include_test_cases` on create. **This plan depends on that one shipping first.**

---

## Scope

### In scope
- New `TestSuiteTreeSelector` component (or extension of `TestSuiteTree`) supporting checkbox state per node, propagation rules, and emitting a flat list of selected case ids
- Replace the dropdown + DataTable in `TestRunCreateView.vue` with the new selector
- Auto-check propagation:
  - **Suite checked** → all descendant suites and all cases within them check
  - **Suite unchecked** → all descendants uncheck
  - **All cases of a suite checked individually** → suite shows checked
  - **Some cases of a suite checked** → suite shows indeterminate
- Lazy-load test cases per suite as the user expands the tree (avoid loading every case on mount)
- Keep filters (priority, type, status, search) above the tree; filters narrow which cases are *visible*, not which are *selectable* — selection state persists across filter changes
- Show a running summary: `N test cases selected across M suites`
- Submit the flat selected case id list as `include_test_cases` (already in the create payload)
- Unit test the propagation logic (pure function); e2e for the create-with-suite-checkbox flow

### Out of scope
- Refactoring the project test cases page (`TestCaseListView`) to use the new selector — keep that page on its current `TestSuiteTree` (no checkboxes) for now
- Editing an existing run's case set (would require the new `PUT /test-runs/{id}/cases` endpoint from the backend plan; deferred to a follow-up plan)
- Saving / loading selection presets
- Drag-and-drop reordering of selected cases
- Selecting cases via tag (handled by the tag-filter plan)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-cases/TestSuiteTreeSelector.vue` (new, or `TestSuiteTree.vue` extended via prop) | Recursive tree with PrimeVue `Checkbox` per node; propagation logic; emits `update:selectedCaseIds` |
| composables | `src/composables/useSuiteSelection.ts` (new) | Pure logic: given the suite tree + per-suite case lists + a `Set<number>` of selected case ids, compute each suite's checkbox state (`checked` / `unchecked` / `indeterminate`); apply suite-toggle propagation |
| views | `src/views/test-runs/TestRunCreateView.vue` | Remove the suite dropdown and the DataTable case picker; mount `TestSuiteTreeSelector` bound to `selectedCaseIds`; show the selection summary; lazy-load cases per suite via `testCasesStore.fetchTestCasesBySuite(suiteId)` |
| store | `src/stores/testCases.ts` | Add `casesBySuite: Map<number, TestCase[]>` and `fetchTestCasesBySuite(suiteId)` action that caches per suite to avoid refetches on tree expand/collapse |
| store | `src/stores/testSuites.ts` | No structural change — `fetchTestSuites(projectId)` already returns the tree shape needed |
| api | `src/api/testCases.ts` | Confirm `getTestCases({ suite_id })` exists and returns the per-suite list (it does — already used by the list view) |
| types | `src/types/testRun.ts` | `include_test_cases: number[]` already present; verify and remove any `?` if optional |

### Key decisions

- **Reuse vs new component**: introduce a new `TestSuiteTreeSelector` rather than mutating `TestSuiteTree`. Reasons: (a) the existing tree has no checkbox concept; bolting it on with a prop branches the rendering logic; (b) the list page consumer of `TestSuiteTree` should stay unchanged. The two components can share the same recursive shape and even import the same row template.
- **Propagation logic in a composable, not the component**: the rules are pure (input: tree, selected set, toggled node → output: new selected set + per-suite states). Pure logic is unit-testable without mounting Vue. The component just calls the composable and renders.
- **Indeterminate state**: a suite is `indeterminate` when *some* (but not all) of its descendant cases are selected. PrimeVue `Checkbox` supports indeterminate via `:indeterminate` binding. Computed per-suite at render time from the selected set and the cached per-suite case lists.
- **Lazy load cases per suite on expand**: loading every case in the project up-front is wasteful for large projects and slows the initial dialog. Fetch on first expand, cache in `casesBySuite`. A suite the user never expands never triggers a fetch.
- **Selection state is the source of truth**, not per-checkbox refs: a single `selectedCaseIds: Set<number>` in the view component (or composable) drives every checkbox. Toggling propagates by mutating that set. Avoids drift between tree state and submit payload.
- **Filters narrow visibility, not selectability**: if the user filters to `priority=high`, then unchecks visible cases, only the visible (high-priority) cases lose their selection — previously selected `medium` cases stay in the set even though they are hidden. The summary reflects total selected, not visible selected. This matches how Gmail and most table UIs handle filtered selections, and avoids the surprise of "I filtered and lost my selection".
- **Suite checkbox propagation respects filters**: when the user clicks a suite checkbox, it adds/removes only the cases *currently visible* under that suite given active filters. This makes the filters useful as a scoping tool ("select all high-priority cases in this suite").
- **Empty selection is allowed at submit time** — the run can be created empty if the user wants to add cases later. Do not block the submit button unless the backend rejects empty selections (per backend plan, empty list is honored as "explicit empty").
- **No suite_id sent**: with explicit case selection, the legacy `suite_id` field on the create payload becomes meaningless. Send `null` for `suite_id` when `include_test_cases` is non-empty. Document this.

---

## Tasks

### Implementation
- [x] Add `casesBySuite` cache + `fetchTestCasesBySuite(suiteId)` action to `src/stores/testCases.ts`
- [x] Create `src/composables/useSuiteSelection.ts` exporting:
  - `computeSuiteState(suite, selectedCaseIds, casesBySuite): 'checked' | 'unchecked' | 'indeterminate'`
  - `toggleSuite(suite, selectedCaseIds, casesBySuite, visibleFilter): Set<number>`
  - `toggleCase(caseId, selectedCaseIds): Set<number>`
- [x] Unit tests for the composable — empty tree, single suite, nested suites, indeterminate, filter-scoped propagation
- [x] Create `src/components/test-cases/TestSuiteTreeSelector.vue`:
  - Recursive structure mirroring `TestSuiteTree`
  - PrimeVue `Checkbox` on each suite row and each case row
  - Lazy-load on expand via the store action
  - Bind to a `v-model:selectedCaseIds` prop
- [x] Update `src/views/test-runs/TestRunCreateView.vue`:
  - Remove the suite dropdown and the DataTable case picker
  - Mount `TestSuiteTreeSelector` with filters (priority/type/status/search) above
  - Add a sticky summary line: `{{ selectedCaseIds.size }} test cases selected`
  - On submit, send `include_test_cases: [...selectedCaseIds]` and `suite_id: null`
- [x] Verify `include_test_cases` is in `src/types/testRun.ts` and is `number[]` (not optional)
- [x] e2e: `tests/e2e/test-run-suite-tree-select.spec.ts`:
  - Open create dialog, expand a suite, check it, verify all its cases are checked
  - Uncheck one case, verify the suite turns indeterminate
  - Submit, verify the run is created with the expected case set (call `GET /test-runs/{id}/cases`)

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke against real backend: create a run with cases drawn from multiple suites, verify the run detail page shows exactly those cases

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` — note that `createTestRun` payload now meaningfully sends `include_test_cases`
- [x] `docs/01-product/features/test-run-planning.md` (or equivalent) — describe the new tree selector and propagation rules
- [x] `docs/02-architecture/ARCHITECTURE.md` — add `TestSuiteTreeSelector` and `useSuiteSelection` to the codemap and "Where is X?" table
- [x] `docs/03-engineering/patterns/composables.md` — document the selection composable pattern if novel
- [x] `docs/08-decisions/changelog.md` — record: new component over mutating `TestSuiteTree`, indeterminate via composable, lazy-load per suite, filters narrow visibility not selection, propagation respects filters, `suite_id: null` when explicit selection
- [x] `docs/04-execution/tech-debt.md` — log "edit run case set" as a follow-up that needs `PUT /test-runs/{id}/cases` (backend already ships it in plan 025)
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend plan 025 not yet merged when this lands | High | Sequence: backend plan ships first; gate this plan's merge on backend availability; until then frontend would silently no-op the selection |
| Lazy load on expand creates a flicker / spinner thrash | Medium | Show a small per-row skeleton; cache aggressively in `casesBySuite`; only refetch on explicit reload |
| Indeterminate calculation is O(n) per render and lags on large trees | Medium | Memoize per-suite state via `computed` keyed on the selected set's size + suite id; recompute only on toggle |
| User filters mid-selection and is confused by hidden selected cases | Medium | Summary always shows total selected; add a "show only selected" filter toggle as an optional follow-up |
| Removing the DataTable removes useful columns (priority, type, etc.) | Low | Add a small badge row next to each case label in the tree showing priority/type compactly |
| Selection state lost on accidental dialog close | Medium | If the create view is a dialog, prompt before close when `selectedCaseIds.size > 0` |

---

## Definition of done

- [x] Test run create page renders a suite tree with checkboxes, replacing the old DataTable
- [x] Checking a suite selects all visible (post-filter) cases under it; unchecking deselects them
- [x] Suites with partial selections render with an indeterminate checkbox
- [x] Selection persists across filter changes
- [x] Submitting creates a run whose `GET /test-runs/{id}/cases` returns exactly the selected cases
- [x] All hard invariants respected — no component imports from `src/api/`
- [x] Unit tests for the selection composable cover empty / single / nested / indeterminate / filtered scenarios
- [x] e2e covers create-with-suite-checkbox + selection round trip
- [x] PR checklist completed
- [x] Docs updated
