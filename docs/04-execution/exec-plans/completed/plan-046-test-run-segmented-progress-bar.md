# Execution Plan: Segmented Test Run Progress Bar + Correct Counts

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs/:id` and `/test-runs/:id/execute`, replace the single-color `ProgressBar` with a segmented bar that shows **Passed (green) / Failed (red) / Blocked (dark gray) / Skipped (light gray)** as proportional slices of the run's total test cases, and fix the passed/total count text on both pages by consuming the backend `/test-runs/{id}/progress` endpoint instead of computing counts locally from whatever results happen to be loaded.

---

## Context

Today both pages read progress from `testResultsStore.progress` (`src/views/test-runs/TestRunDetailView.vue:44`, `src/views/test-runs/TestRunExecutionView.vue:611–620`), which is computed client-side in `src/stores/testResults.ts:51–71` from whatever `results` are in memory. That has three bugs:

1. **Wrong total** — `src/stores/testResults.ts:52`: `total = totalCasesInRun.value || results.value.length`. When `totalCasesInRun` is unset, the total collapses to the number of loaded results, so "passed 3 / 3 total" shows even when the run has 50 cases.
2. **Wrong untested** — `src/stores/testResults.ts:58`: `untested = total - results.value.length` should be `total - executed`.
3. **Misleading pass rate** — `src/stores/testResults.ts:68`: `passRate = (passed / total) * 100` deflates the number while cases are still untested. The backend already defines pass rate as `passed / tested` (`api-testoria/app/services/test_run_service.py:173`) — the two sides disagree on the metric.

Meanwhile, `GET /test-runs/{id}/progress` already exists (`app/api/v1/test_runs.py:112–118`) and returns `{ passed, failed, blocked, skipped, untested, total, pass_rate }` — all the fields both views need. The frontend also already has `getTestRunProgress` in `src/api/testRuns.ts:63`, but **no store action calls it on mount**. `stores/testRuns.updateTestRunProgress` (line 162) only applies server-pushed updates; there is no fetch.

The progress bar itself is a stock PrimeVue `ProgressBar` bound to a single percentage (`TestRunDetailView.vue:218–223`, `TestRunExecutionView.vue:611–615`), so the "show four colored segments" requirement cannot be met by tweaking the existing component — a new segmented bar is needed.

---

## Scope

### In scope
- New `TestRunProgressBar` component rendering four proportional segments (Passed/Failed/Blocked/Skipped) with theme tokens and accessible labels
- New `fetchProgress(runId)` action on `stores/testRuns` that calls `getTestRunProgress` and stores the result on `currentTestRun.progress` (reusing the existing `progress` field the store already expects)
- `TestRunDetailView.vue` and `TestRunExecutionView.vue` consume `testRunsStore.currentTestRun.progress` (backend-authoritative) instead of `testResultsStore.progress` for the bar + the count text
- Refresh the progress after any result change: after submitting a result in the execution view, after closing the run, after a WebSocket push
- Delete / deprecate the broken local computation in `stores/testResults.ts:51–71` (keep the `testResults` array state; remove only the buggy `progress` computed)
- Unit test the new component (renders correct widths for mixed/empty/all-one-status cases)
- e2e: open a run detail page mid-execution and assert the count text matches the backend

### Out of scope
- Changing the backend progress endpoint or its math (already correct)
- Styling the status breakdown rows beneath the bar (lines 232–257 of the detail view) — those can stay; only the bar + header counts change
- Hover tooltips per segment (nice-to-have; defer unless trivial)
- Animating width transitions (defer)
- Run list view progress indicators (separate screen, not in this plan)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-runs/TestRunProgressBar.vue` (new) | Receives `progress: TestRunProgress` prop; renders a horizontal bar with four segments sized by `passed/total`, `failed/total`, `blocked/total`, `skipped/total`; the remaining width is the untested portion (empty / neutral background) |
| store | `src/stores/testRuns.ts` | Add `async fetchProgress(runId)` action that calls `getTestRunProgress`, writes the result onto `currentTestRun.progress`, and returns it; existing `updateTestRunProgress` stays for WebSocket pushes |
| store | `src/stores/testResults.ts` | Remove the local `progress` computed (lines 51–71); keep `results`, `totalCasesInRun`, and the fetch actions |
| views | `src/views/test-runs/TestRunDetailView.vue` | Replace `<ProgressBar :value="progress.passRate" />` block with `<TestRunProgressBar :progress="runProgress" />`; change the count text to `{{ runProgress.passed }}/{{ runProgress.total }} passed`; call `testRunsStore.fetchProgress(runId)` in `onMounted`; re-fetch after any result change emitted by child components |
| views | `src/views/test-runs/TestRunExecutionView.vue` | Same substitution; call `fetchProgress` after each successful `submitResult` |
| types | `src/types/testRun.ts` | Ensure `TestRunProgress` has all fields in snake_case matching the backend response (`pass_rate` not `passRate`); if the existing type uses camelCase, reconcile the transformation |

### Key decisions

- **Backend-authoritative progress**: the single source of truth for counts is `GET /test-runs/{id}/progress`. The frontend never computes counts from the in-memory `results` array. Reason: the `results` array reflects *loaded* results, not all results. The earlier architecture tried to derive progress from it and that is the direct cause of the bug.
- **Segment widths use `total` as the denominator, not `tested`**: the bar visually represents the full case set. The empty/untested tail is a meaningful part of the picture — collapsing it would hide "half the run isn't executed yet". The pass-rate *text* (if shown) separately uses `passed / tested` to match the backend definition.
- **Count header format**: `passed/total` not `passed/tested`. Reason: the user's mental model from the bug report is "X out of Y total", and that's what they expect to read. A second, smaller label can show `{executed} executed · {untested} untested` if we want the full breakdown; for this plan keep it simple with just `passed/total` plus the existing status breakdown row.
- **Colors from theme tokens, not hardcoded hex**: passed → `var(--green-500)` (or whatever token is already used for "passed" status tags elsewhere in the app — reuse, do not invent), failed → `var(--red-500)`, blocked → `var(--surface-700)` (dark gray), skipped → `var(--surface-400)` (light gray). Verify each token against existing usage before picking.
- **New component not a PrimeVue extension**: PrimeVue `ProgressBar` is single-value. Writing a small custom component with four `<div>` segments is simpler than monkey-patching, and accessibility can be done properly (`role="progressbar"` with `aria-valuenow` on each segment plus a single aria-labelled group).
- **Delete the broken `testResults.progress` computed, don't "fix" it in place**: keeping two progress sources invites divergence. Views use `testRunsStore.currentTestRun.progress` only.
- **Refetch on result change** — after `submitResult` in the execution view, `await testRunsStore.fetchProgress(runId)`. Prefer a full refetch over local count-bumping: the backend already knows the truth and the endpoint is cheap.
- **WebSocket path unchanged**: the existing `updateTestRunProgress` action continues to accept pushed `TestRunProgress` payloads from Centrifugo. This plan adds a *pull* path; the push path already exists.

---

## Tasks

### Implementation
- [x] Verify `TestRunProgress` type in `src/types/testRun.ts` matches the backend response field names; reconcile if snake_case / camelCase drift
- [x] Add `fetchProgress(runId)` action to `src/stores/testRuns.ts`; writes to `currentTestRun.progress` and returns the fresh progress
- [x] Create `src/components/test-runs/TestRunProgressBar.vue`:
  - Props: `progress: TestRunProgress`
  - Template: `<div role="progressbar" …>` with four child segments
  - Segment widths computed from `passed/total`, `failed/total`, `blocked/total`, `skipped/total`; untested = `100% - sum`
  - Safeguard: if `total === 0`, render a single empty neutral bar
  - Colors from theme tokens reused from existing status tags
  - Scoped styles; no global leakage
- [x] Update `src/views/test-runs/TestRunDetailView.vue`:
  - Import `TestRunProgressBar`
  - Replace the existing `<ProgressBar>` block (line ~218) with `<TestRunProgressBar :progress="runProgress" />`
  - Change the count text (line ~225) to `{{ runProgress.passed }}/{{ runProgress.total }} passed`
  - Replace `const progress = computed(() => testResultsStore.progress)` with a reactive `runProgress` pointing at `testRunsStore.currentTestRun?.progress`
  - Call `testRunsStore.fetchProgress(runId)` in the existing `onMounted` (or alongside `loadTestRun`)
- [x] Update `src/views/test-runs/TestRunExecutionView.vue`:
  - Same replacement (line ~611)
  - Count text (line ~617): show backend values
  - After each successful `submitResult`, `await testRunsStore.fetchProgress(runId)`
- [x] Remove the local `progress` computed from `src/stores/testResults.ts:51–71`; keep `results` state and actions intact
- [x] Search the repo for any other consumer of `testResultsStore.progress` and migrate or delete them
- [x] Unit test `TestRunProgressBar.vue`:
  - Renders four segments with correct widths for a mixed result set
  - Renders empty neutral bar when `total === 0`
  - Renders a single full green segment when every case passed
  - Segments sum to ≤100% (never overflows due to rounding)
- [x] Unit test `testRuns.fetchProgress` (mock the API call)
- [x] e2e: mid-execution smoke — create a run with 5 cases, submit 2 passed + 1 failed + 1 blocked, reload the detail page, assert the header reads `2/5 passed` and that the bar has the expected non-zero segments

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc catches any stale references to the deleted computed)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke in both light and dark mode: colors of each segment are distinguishable and match the status tags elsewhere in the app

### Docs update (Phase 5)
- [x] `docs/02-architecture/ARCHITECTURE.md` — add `TestRunProgressBar` to the codemap and the "Where is X?" table
- [x] `docs/01-product/features/test-execution.md` (or the test-run feature doc) — describe the segmented progress bar and note that counts are backend-authoritative
- [x] `docs/08-decisions/changelog.md` — record: custom component over PrimeVue extension, `total` as segment denominator, backend-authoritative progress, removal of local computed, count header format
- [x] `docs/04-execution/tech-debt.md` — close any open item referencing wrong run counts
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map / api-schema update — no routes or API calls added.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Other code paths silently depended on `testResults.progress` | Medium | Repo-wide search before deletion; TS + build will catch direct references |
| Rounding makes segment widths sum to 100.3% and push the layout | Low | Compute the last visible segment as `100 - sum(previous)` so rounding error absorbs there |
| Theme tokens for dark gray / light gray don't exist | Low | Reuse whatever tokens current status tags use (read those components first); if none, add one CSS variable in the scoped styles |
| `fetchProgress` fires before `loadTestRun` resolves and writes to an undefined `currentTestRun` | Medium | Await `loadTestRun` first (or make `fetchProgress` lazy-init the progress field on whatever run is current); assert in the action |
| Execution view re-fetches on every keystroke of a freeform result comment | Low | Only fetch after `submitResult` succeeds, not on any form change |
| Backend progress endpoint is slow on large runs, making every submit feel laggy | Low | Endpoint is two count queries; fine for now. If it becomes slow, add an in-memory debounced refetch later |

---

## Definition of done

- [x] Both `/test-runs/:id` and `/test-runs/:id/execute` render a segmented progress bar with Passed / Failed / Blocked / Skipped slices in green / red / dark gray / light gray
- [x] The `passed/total` count text matches the backend `/progress` response exactly on both pages
- [x] The count text updates after every submitted result in the execution view
- [x] The local `progress` computed in `stores/testResults.ts` is removed and no view references it
- [x] All hard invariants respected — no component imports from `src/api/`
- [x] Unit tests for the new component pass, including the rounding and empty-state cases
- [x] e2e asserts correct header count mid-execution
- [x] PR checklist completed
- [x] Docs updated
