# Execution Plan: Create empty test run; edit cases later via the same suite-tree flow

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Let the user create a test run with zero selected cases and add / change cases later from `/test-runs/:id` using the same suite-tree selector the create wizard already uses — no duplicate UI.

---

## Context

Today the wizard in `src/views/test-runs/TestRunCreateView.vue` forces at least one case before submit (`validateStep2`, lines 165-176). After submission the run is fixed — the detail page only shows progress and executed results. If a user wants a run scaffolded now and populated later (common with sprint planning), they have to pick placeholder cases and edit them out manually.

The suite-tree picker itself is already reusable (`src/components/test-cases/TestSuiteTreeSelector.vue`). The store wiring is in place:

- `testRunsStore.createTestRun(projectId, { include_test_cases: [] })` — API plan 034 makes this mean "explicit empty selection"
- `PUT /test-runs/{id}/cases` — already exists; frontend just needs a store action and UI to trigger it

The web changes are:
1. Remove/soften the min-1-case validation in the wizard
2. Expose a "Create empty run" path (either the existing wizard with step 2 skippable, or a dedicated button that jumps to step 3)
3. On `/test-runs/:id`, add an "Edit cases" button that opens a dialog containing the same suite-tree selector, pre-selected to the run's current case set, and saves via `PUT /test-runs/{id}/cases`
4. Refresh the cases list (consumes plan 055's `fetchRunCasesWithResults`) after a successful edit

Depends on api plan 034 for the "explicit empty" semantic. Aligns with plan 055 for the "show every case including no_run" detail view.

---

## Scope

### In scope
- **Create wizard** (`TestRunCreateView.vue`):
  - Drop the "at least one case" validation
  - Make step 2 (case selection) skippable: a "Skip and create empty" link at the bottom of step 2 jumps straight to step 3 review
  - Step 3 review shows "0 cases selected — you can add them from the run detail page" when empty; Create button stays enabled
  - Submit sends `include_test_cases: []` (explicit empty), not `undefined`
- **Run detail page** (`TestRunDetailView.vue`):
  - New "Edit cases" button (manager / tester roles — matches `canManageTests`) in the page-header actions row
  - Opens a full-screen dialog (`EditRunCasesDialog.vue`, new) that hosts the existing `TestSuiteTreeSelector` pre-selected to the current case set
  - Save → calls `testRunsStore.setRunCases(runId, [...selectedIds])` (new action) → refreshes progress + cases list
  - Cancel discards changes
  - Dialog shows the same search / expand behaviour as the wizard; reuse the composables already in place
- **Empty-state on the list** (`TestResultsList.vue` via plan 055): when the run has zero cases, show an empty state with a primary "Add cases" CTA that opens the same dialog
- **Store**:
  - `testRunsStore.setRunCases(runId, caseIds: number[])` → `PUT /test-runs/{runId}/cases` → on success refetches progress + cases
  - Expose the run's `cases_mode` from the API response (added by plan 034) so the UI can show "manual selection" vs "derived" as a subtle label / badge on the detail page
- **Type updates**: add `cases_mode: "auto" | "explicit"` to the `TestRun` type; make `include_test_cases` explicitly `number[]` in `TestRunCreate` (not `undefined`) so `[]` serialises cleanly
- **Tests**:
  - Unit: wizard allows step 3 with zero cases; submit payload carries `include_test_cases: []`
  - Unit: store action calls the API and refetches
  - Unit: dialog pre-selects current ids; save emits the new list
  - E2E: create an empty run; land on detail; click "Edit cases"; pick 3 cases; save; detail list now shows 3 rows

### Out of scope
- Re-theming the wizard or splitting it into a different number of steps
- Adding a saved-query / tag-filter case picker
- "Reset to auto mode" affordance (run derives from suite again) — logged as tech debt
- Bulk-move cases between runs
- Permissions beyond the existing `canManageTests` check
- Mobile-specific layout for the edit dialog — reuse the wizard's responsive behaviour
- Reordering cases within a run

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testRun.ts` | `cases_mode: "auto" \| "explicit"` on `TestRun`; adjust `TestRunCreate.include_test_cases` to `number[]` (required), default `[]` at the call site |
| api | `src/api/testRuns.ts` | Add `setRunCases(runId, caseIds)` wrapping `PUT /test-runs/{runId}/cases` |
| store | `src/stores/testRuns.ts` | `setRunCases(runId, caseIds)` action: call api; await `fetchTestRun(runId)` + `fetchProgress(runId)`; re-trigger detail list refresh via the `testResults` store action (plan 055) |
| views | `src/views/test-runs/TestRunCreateView.vue` | Drop `validateStep2`; add "Skip" link in step 2; allow step 3 with empty selection; update `handleCreate` to always send `include_test_cases: [...selectedCaseIds.value]` (empty array allowed) |
| views | `src/views/test-runs/TestRunDetailView.vue` | Add "Edit cases" button (guarded by `authStore.canManageTests`); render `EditRunCasesDialog` with v-model on a `showEditCases` ref; on save, refresh |
| components | `src/components/test-runs/EditRunCasesDialog.vue` (new) | Thin wrapper around `TestSuiteTreeSelector` with dialog chrome, pre-selected ids, save/cancel actions |
| components | `src/components/test-runs/TestResultsList.vue` | Empty-state variant when run has zero cases — add a slot or prop for the CTA; primary button emits an event the detail view catches to open the dialog |
| tests | `tests/unit/views/TestRunCreateView.spec.ts` | "Skip" path renders step 3 with zero cases; submit sends `[]` |
| tests | `tests/unit/stores/testRuns.spec.ts` | `setRunCases` action hits the api and refreshes |
| tests | `tests/unit/components/EditRunCasesDialog.spec.ts` | Pre-select, save, cancel |
| tests | `tests/e2e/test-run-empty-then-edit.spec.ts` | Full flow: create empty → edit → execute |

### Key decisions

- **Reuse, don't fork**. `TestSuiteTreeSelector` already handles load, expand, search, and selection. The edit dialog is a dialog wrapper around it, not a re-implementation. Keeps a single source of truth for case-selection UX.
- **Explicit empty array, not `undefined`**. Sending `include_test_cases: []` (after api plan 034) means "explicit empty selection". Sending `undefined` would mean "derive from suite/project", which is not what the user asked for. Type the field as `number[]` (required, default `[]`) in `TestRunCreate` to make the distinction unambiguous at the TS level.
- **Wizard stays 3 steps**. Don't collapse to 2 — the review step is useful even when empty, and the "skip" link is a clearer affordance than a conditional step. The review step renders "0 cases selected — you can add them later" as the content when empty.
- **Dialog, not a separate route**. `/test-runs/:id/edit-cases` would work but adds a route and a second mount of suite data. A dialog overlay on the detail page shares the store-cached suites/cases, and cancel closes without any navigation state to unwind.
- **Role-gate the edit action**. Same rule as other test-run mutations — `authStore.canManageTests`. Admins / leads / testers can edit; read-only users see no button. The backend enforces the same rule via `require_role(*_TESTER)`; the UI check is a polish, not a security boundary.
- **Refresh strategy after save**: (a) re-fetch the run (`cases_mode` may have flipped `auto` → `explicit` per plan 034), (b) re-fetch progress, (c) re-fetch the cases list via plan 055's action. Three parallel requests; cheap, no perceived flicker with the dialog's own spinner.
- **`cases_mode` badge**: show a small tag near the run name — "Manual cases" when `explicit`, no badge when `auto` (auto is the default; surfacing it everywhere would be noise). Small UX hint, not a core feature; include in the same PR since the data is already on the wire.
- **Empty-state CTA in `TestResultsList`**. When the run has zero cases, the list shows an empty state with a primary "Add cases" button that emits an event the parent handles. This reuses the dialog opener and avoids a second code path.
- **No optimistic update**. The edit is rare and the run detail already refetches on success; adding optimistic state would complicate cancel/error paths. Show the dialog's own loading state on Save.

---

## Tasks

### Implementation
- [ ] Confirm api plan 034 is merged (or at least the create accepts `include_test_cases: []` as explicit-empty)
- [ ] Update `src/types/testRun.ts`: add `cases_mode`; tighten `include_test_cases` to `number[]` with a default of `[]` at call sites
- [ ] Add `setRunCases(runId, caseIds)` in `src/api/testRuns.ts`
- [ ] Add `setRunCases(runId, caseIds)` action in `src/stores/testRuns.ts` — updates run, progress, and triggers the cases-with-results refresh (plan 055)
- [ ] `TestRunCreateView.vue`:
  - Remove the "at least one case" toast/validation in `validateStep2`
  - Add a "Skip — create without cases" link/button at the bottom of step 2
  - Step 3 renders "0 cases selected" + hint text when empty
  - `handleCreate` always sends `include_test_cases: [...selectedCaseIds.value]`
- [ ] Create `src/components/test-runs/EditRunCasesDialog.vue`:
  - Props: `modelValue`, `runId`, `projectId`, `initialSelectedIds`
  - Inner: `TestSuiteTreeSelector` bound to a local selected-ids set
  - Actions: Cancel (close), Save (call store action; close on success; toast on error)
  - Loading state while saving
- [ ] Wire the dialog into `TestRunDetailView.vue`:
  - "Edit cases" button in `header-actions`, gated by `canManageTests`
  - Dialog v-model on `showEditCases`
  - On save: rely on the store's refetch; no view-level manual refresh
- [ ] Add the "Manual cases" badge to the run header when `cases_mode === "explicit"`
- [ ] Extend `TestResultsList.vue` empty-state: when `results.length === 0` and the run's `cases_mode === "explicit"`, show an "Add cases" primary CTA that emits `edit-cases`; parent opens the dialog
- [ ] Unit tests (all bullets in Scope)
- [ ] E2E: create empty, edit, reopen, verify persistence
- [ ] Manual:
  - Create a run via the wizard and skip step 2; land on `/test-runs/:id`; see empty state with "Add cases" CTA
  - Click Edit cases; add 3 cases via the suite tree; save; confirm 3 `no_run` rows (via plan 055) appear immediately
  - Edit again; deselect 1; save; 2 rows remain
  - Cancel discards changes

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — confirm `PUT /test-runs/{id}/cases` is documented; note `cases_mode` field on the run response
- [ ] `docs/06-generated/routes-map.md` — no change (no new routes)
- [ ] `docs/01-product/features/005-test-run-planning.md` (or `006-test-execution.md`) — document the new "empty run + edit later" flow
- [ ] `docs/02-architecture/frontend/state-management.md` — note the new store action if the store inventory is listed there
- [ ] `docs/08-decisions/changelog.md` — record: dialog over route; reuse of `TestSuiteTreeSelector`; relies on api plan 034
- [ ] `docs/04-execution/tech-debt.md` — log (a) "reset to auto mode" affordance if requested, (b) drag-reorder cases within a run
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Frontend sends `include_test_cases: []` before api plan 034 lands; backend collapses empty into "auto" and derives a huge case list | High if ordering slips | Gate merge on plan 034 being deployed; add a release-notes item "empty runs require api ≥ X" |
| User skips step 2 and forgets to return; run sits empty forever and confuses the planner | Medium | Detail page's empty state is explicit ("0 cases — Add cases") with a primary CTA; run listing may show "0 cases" hint — consider a small badge on the list (out of scope here, log as polish) |
| The edit dialog loads suites/cases on every open and feels slow | Medium | Store-level cache (`casesBySuite`) already present; dialog uses the cached data; fetch only missing suites on expand |
| Saving with a reduced list deletes historical results — user data loss perception | High | Backend already handles this on `set_run_cases` today; add a confirm toast "This will remove X cases (and their results) from this run" when the dialog save reduces the set |
| Tree selector pre-selection is wrong because the current case set is paginated (plan 033 cap) | Low | Detail page already consumes the full case list via plan 055; pass `initialSelectedIds` from that list |
| Role gate drift — "Edit cases" shows for users the backend rejects | Low | Use `authStore.canManageTests` which already maps to the same roles the backend enforces |
| Re-fetching progress after save causes a flicker in the progress bar | Low | The store keeps previous progress in memory until the new one lands; the bar animates |
| `TestRunExecutionView.vue` stale state if the user edits cases while executing in another tab | Low | Out of scope — document as a known cross-tab limitation; future websocket-driven refresh (plan 008 WS infra already merged) can address it |

---

## Definition of done

- [ ] User can create a test run with zero selected cases via the wizard (skip link or empty Next click)
- [ ] The created run has `cases_mode: "explicit"` (verified via DevTools network tab)
- [ ] `/test-runs/:id` shows an empty state with a primary "Add cases" CTA when the run has zero cases
- [ ] "Edit cases" button (when `canManageTests`) opens a dialog with the suite-tree selector pre-selected to the current case set
- [ ] Saving the dialog issues `PUT /test-runs/{id}/cases`, then refreshes run + progress + cases list
- [ ] Reducing the set (removing a case) persists after page reload
- [ ] `cases_mode === "explicit"` shows a subtle "Manual cases" badge on the detail header
- [ ] Unit + E2E tests pass
- [ ] Backend plan 034 merged and deployed before this plan's PR lands on main
- [ ] Docs updated
- [ ] PR checklist completed
