# Execution Plan: Show every case (including `no_run`) on the test-run detail page

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs/:id`, render a row for every test case that belongs to the run — not only cases with an existing `TestResult`. Cases without a result appear with status `no_run` (the new default introduced by plan-054), so the list matches the run's total and nothing is hidden.

---

## Context

Today the detail page (`src/views/test-runs/TestRunDetailView.vue:56-62`, `TestResultsList.vue`) calls `testResultsStore.fetchResults(runId)`, which hits `GET /api/v1/test-results?run_id=…` and returns **only rows that already exist in `test_results`**. Cases in the run that haven't been executed yet are counted in the progress bar as `untested` (`testResults.ts:34`) but **never rendered as a row**.

This breaks two expectations:

1. The "Test Results" list claims to be the run's contents, but it's really "cases that have been touched". A planner expects to open a run and see all selected cases.
2. After plan-054 renames `skipped` → `no_run` and makes it the default pick, there is no visual difference between "tester explicitly chose no_run" and "no one touched this yet" — *unless* both show up in the list with the same status.

The backend already exposes everything needed. `GET /api/v1/test-runs/{run_id}/cases` returns `TestRunWithCases`:

```py
# api-testoria/app/schemas/test_run.py:64-76
class TestCaseWithResult(...):
    ...
    result: TestResultResponse | None = None

class TestRunWithCases(BaseModel):
    run: TestRunResponse
    cases: list[TestCaseWithResult]
```

The service assembles this via an `outerjoin` on `TestResult`, so every case in the run's case-set is returned with `result=null` if no row exists (`test_run_service.py:278-327`). The page just needs to consume this endpoint instead of the results-only one, and treat `result == null` as a synthetic `no_run` row for display.

Api plan 033 covers small BE gaps (limit increase beyond the current 500, sort by case id vs suite order, ensure `title/type/priority/tags/automation_id` are all present on `TestCaseWithResult`). This web plan assumes plans 054 + 032 are in-flight or merged (the literal `"no_run"` exists) and plan 033 ships alongside if any BE change is needed.

---

## Scope

### In scope
- `TestRunDetailView.vue` switches from `fetchResults` to a new store action that calls `GET /test-runs/{runId}/cases`
- New `testResultsStore.fetchRunCasesWithResults(runId)` action populating `results.value` with **synthesised rows for cases without a `TestResult`** (status `no_run`, null timestamps, empty step_results, etc.)
- Synthesis rule: if `case.result` is null, produce a client-only `TestResult`-shaped object with:
  - `id: null` (sentinel — never persisted, never sent back)
  - `test_case_id: case.id`
  - `status: "no_run"`
  - `test_case: { id, title, type, priority }` populated from the case
  - `tested_at: null`, `tested_by: null`, `comment: null`, `step_results: null`, `defects: []`, `attachments: []`
- `TestResult` type gains `id: number | null` (nullable) OR a sibling type `TestRunCaseRow` is introduced (decision below) to avoid littering `id: null` handling everywhere
- `TestResultsList.vue` filter/sort/counts include the synthetic `no_run` rows; `status` filter treats them like any other status; search matches on title/id as today
- `TestResultCard.vue` handles a row with `id: null`: no "View history" action (nothing to show), no attachments link, "Edit" still works (it routes to the execution view by `test_case_id`, which is already the case)
- `TestResultDetail.vue` handles selection of a synthetic row: show the case metadata + a "This case has not been run yet" empty state instead of the history/comment/attachment panels
- Stats derived from the list now align with `TestRunProgress` from the backend (no more "results.length" vs "total" drift)
- Progress bar on the detail page reads from `runProgress` (unchanged) — the synthesis is list-layer only; counts are authoritative from `GET /test-runs/{id}/progress`
- `TestRunExecutionView.vue` optionally also migrated to the same data source for consistency (recommended but optional — tracked as a follow-up if skipped)
- Unit tests cover: null result → synthesised row; counts match total; filter by `no_run` returns synthetic rows; clicking a synthetic row opens the case-not-yet-run detail panel

### Out of scope
- Backend-side materialisation of `no_run` rows (creating empty `TestResult` rows at run creation) — explicitly not done; synthesis is client-side
- Pagination UI — the endpoint currently caps at 500 cases; if that limit is raised in api plan 033, this plan consumes the new cap but does not add pagination controls
- Redesigning the progress bar or stats breakdown
- Changing the execution view's data source (optional, flagged as follow-up)
- Export (PDF / Excel) behaviour — keep exporting only executed results for now; if product wants "no_run" in exports, add as a separate plan

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| api | `src/api/testRuns.ts` (or equivalent) | Ensure there's a wrapper for `GET /test-runs/{id}/cases` returning `TestRunWithCases`; if missing, add it |
| types | `src/types/testResult.ts` | Either make `TestResult.id` `number \| null`, or add `type TestRunCaseRow = TestResult & { id: number \| null; synthetic: boolean }` — **decision below** |
| store | `src/stores/testResults.ts` | New `fetchRunCasesWithResults(runId)` action; populates `results.value` including synthesised rows; keeps progress sync wired to the authoritative backend progress (drop the manual recount once confirmed) |
| views | `src/views/test-runs/TestRunDetailView.vue` | Replace `fetchResults(runId)` with `fetchRunCasesWithResults(runId)`; no template change (counts now come from the full list) |
| components | `src/components/test-runs/TestResultsList.vue` | Progress reducer now counts `no_run` (from synthesised rows); `executed` excludes `no_run`; empty-state copy unchanged |
| components | `src/components/test-runs/TestResultCard.vue` | Guard `id === null`: skip the "History" affordance, hide "View attachments" count if zero, show a `No Run` badge (works already via `StatusBadge`) |
| components | `src/components/test-runs/TestResultDetail.vue` | When `result.id === null`: render a "not yet run" panel (case metadata + "Execute" button that routes to `/test-runs/:id/execute?testCaseId=:caseId`) |
| tests | `tests/unit/stores/testResults.spec.ts` | Add cases for the new action and synthesis |
| tests | `tests/unit/components/TestResultsList.spec.ts` | Verify `no_run` rows render and filter |
| e2e | `tests/e2e/test-run-detail.spec.ts` | Open a run where not every case has been executed; assert every case appears; filter by `no_run`; click a no-run card and see the "not yet run" panel |

### Key decisions

- **Synthesise client-side, don't materialise server-side**. Creating empty `TestResult` rows on run creation would bloat the DB, complicate soft-delete, and conflate "tester chose no_run" with "never touched". A null-result sentinel on the backend + client synthesis keeps the model clean.
- **Reuse `TestResult` with `id: number | null`**, not a new type. The list, card, and detail components already bind against `TestResult`; adding a sibling type forces every consumer to handle two shapes. A single nullable `id` plus a `synthetic` boolean getter (`id === null`) is the lightest path. Downstream guards: (a) submitting an update or history fetch requires a non-null id — call sites already require a real result, so the only places that change are the new "View history" guard and the "not yet run" detail panel.
- **Backend is the source of truth for progress counts**. Today `syncProgressToTestRun` derives counts from the results array (`stores/testResults.ts:27-47`). After this change, counts from the cases-with-results endpoint happen to match, but the run's `progress` endpoint is still authoritative — keep calling `fetchProgress` and prefer its numbers in the UI. Remove the manual reducer once visual parity is verified.
- **Do not rewrite `GET /test-results`**. It remains the canonical "executed-results" endpoint (used by reports, history, exports). Only the detail page's list switches to the cases-with-results source.
- **Filter/sort consistency**. The existing status filter (`"all" | ResultStatus`) already handles every value of the union — `no_run` slots in without changes once plan-054 merges.
- **Empty-state copy**. When the run has zero cases selected, show the existing empty-state; when the run has cases but none executed, every row is `no_run` — that's a valid "nothing executed yet" view, not an empty state.
- **Execution view migration deferred**. `TestRunExecutionView.vue` uses the case-list it already fetches (suite tree / explicit selection) and the results store. Migrating it to share the same source is a nice-to-have cleanup; flagged as tech debt if not included in this plan.
- **No route changes** — the detail page URL is unchanged.

---

## Tasks

### Implementation
- [ ] Confirm plans 054 + 032 are merged or in-flight; do not ship this plan before `no_run` exists in the API literal
- [ ] If plan 033 raises the backend `limit` cap beyond 500, use the new cap here; otherwise accept 500 as the current upper bound and log a follow-up for pagination
- [ ] Add/confirm API wrapper in `src/api/testRuns.ts` for `GET /test-runs/{id}/cases` returning `TestRunWithCases`
- [ ] Widen `TestResult.id` to `number | null` in `src/types/testResult.ts`; grep every consumer that assumes `id` is present and either (a) guard with `if (result.id == null) return` or (b) narrow with a helper
- [ ] Add a `synthesiseNoRunResult(case)` helper in `src/stores/testResults.ts` or a small pure module under `src/composables/`; unit-test it directly
- [ ] Add `fetchRunCasesWithResults(runId)` action that:
  - Calls `GET /test-runs/{runId}/cases`
  - Maps each `TestCaseWithResult`: if `result` is present, use it; else `synthesiseNoRunResult(case)`
  - Replaces `results.value`
- [ ] Switch `TestRunDetailView.vue` to call the new action on mount; keep `fetchProgress` as authoritative
- [ ] Update `TestResultCard.vue` to guard `result.id === null`:
  - Hide history and attachment affordances
  - Keep the status badge and "Edit" (Execute) action
- [ ] Update `TestResultDetail.vue` to render a "not yet run" panel when `result.id === null`: case title/type/priority/tags, optional steps, and a primary "Execute" button
- [ ] Update `TestResultsList.vue` progress reducer to count `no_run` correctly and exclude it from `executed`
- [ ] Verify the status filter treats `no_run` like other statuses
- [ ] Unit tests:
  - Synthesis: null result → row with `status: "no_run"` and null id
  - Store: new action returns count equal to `cases.length`
  - List: filtering by `no_run` returns only synthesised rows
  - Detail: selecting a synthetic row renders the "not yet run" panel, not the history panel
- [ ] E2E:
  - Seed a run with N cases, execute K < N
  - Open `/test-runs/:id`; assert list shows N rows
  - Filter by `no_run`; assert N - K rows
  - Click a no_run card; assert "not yet run" panel and "Execute" button; click it; lands on execution view for that case
- [ ] Manual check: progress-bar numbers match list counts; no double-count; no off-by-one between `total` and rendered row count
- [ ] Manual check: dark-mode rendering of `no_run` cards
- [ ] Decide on `TestRunExecutionView.vue` migration — implement or log as tech debt

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (vue-tsc catches unguarded `result.id` usages)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — confirm `GET /test-runs/{id}/cases` is documented; if it's missing, add it
- [ ] `docs/01-product/features/006-test-execution.md` — update to describe the detail page now showing every case, including `no_run`
- [ ] `docs/02-architecture/frontend/api-layer.md` — note the two endpoints and when each is used (executed-only vs all-cases)
- [ ] `docs/08-decisions/changelog.md` — record: client-side synthesis chosen over server-side materialisation; rationale; rejected alternative
- [ ] `docs/04-execution/tech-debt.md` — log (a) pagination for runs > 500 cases, (b) optional execution-view migration if not done
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Consumers that assumed `TestResult.id` is always a number break silently | Medium | Make it `number \| null` in TS; vue-tsc fails the build at every unguarded call site; sweep report/history/attachment flows |
| Reports / exports start including synthetic rows and show "no_run" everywhere | Medium | Reports and exports read from `GET /test-results` (unchanged), not the new action; verify via unit test on the exporter |
| Runs with > 500 cases appear truncated; users think cases are missing | Medium | If plan 033 doesn't raise the cap, render a warning banner "Showing first 500 cases — pagination coming in a follow-up" and log tech debt |
| Synthetic rows leak into a submit/update call (`id: null` sent to the backend as a result id) | Low | Helper-level guard: submit/update call sites check `id != null` and go through `submitResult` (create path) instead |
| Progress bar reads one number, list reducer reads another, they drift | Low | Switch the card-level reducer to consume `runProgress` from the test-run store; remove the local reducer in `TestResultsList.vue` |
| History fetch fires on a synthetic row and 404s | Low | Select handler in `TestRunDetailView.vue` already calls `fetchHistory(result.id)` — add `if (result.id == null) return` guard |
| Keyboard/click UX of a "not yet run" card feels dead (nothing to show) | Low | "Not yet run" panel includes case metadata + primary "Execute" CTA — it's an action, not a dead end |

---

## Definition of done

- [ ] `/test-runs/:id` renders a row for every case in the run; row count equals `runProgress.total`
- [ ] Cases without a prior result appear with `status: "no_run"`
- [ ] Status filter `no_run` returns the untouched cases; other filters unaffected
- [ ] Clicking a `no_run` card shows the "not yet run" detail panel with an Execute CTA that lands on the execution view pre-selected to that case
- [ ] Existing history / attachment / edit flows still work for cases with a real `TestResult`
- [ ] No synthetic `id: null` is ever sent to the backend in a submit / update / history call
- [ ] Unit + e2e tests pass
- [ ] Progress bar numbers match list counts; no drift
- [ ] Docs updated
- [ ] PR checklist completed
