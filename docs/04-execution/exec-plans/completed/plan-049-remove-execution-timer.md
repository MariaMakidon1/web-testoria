# Execution Plan: Remove the Timer from the Test Run Execution View

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Delete the manual elapsed-time timer (clock icon + play/pause/reset buttons) from `/test-runs/:id/execute`, remove all of its state, functions, markup, and CSS, and stop populating `execution_time` on submitted test results from it — so the UI stops asking the tester to think about a stopwatch they did not use.

---

## Context

The execution view carries a small stopwatch widget in the per-case card header (`src/views/test-runs/TestRunExecutionView.vue:696–724`): a clock icon, a formatted elapsed time, and three PrimeVue buttons (pause/play/reset). It is driven by two refs and three functions at the top of the script (`elapsedSeconds` and `timerInterval` at lines 53–54; `startTimer` / `stopTimer` / `resetTimer` at lines 110–133), plus CSS at lines 1144, 1153, 1529, 1533, and 1608.

The timer auto-starts when a case is first selected (line 181–183), resets + restarts when the tester navigates between cases (lines 272, 274, 276), and stops on unmount (line 532). Its only **real** output is the `execution_time: elapsedSeconds.value` field passed into the submit payload at **lines 202 and 242**. That value lands in `TestResult.execution_time`, which is nullable in the backend schema (`api-testoria/app/schemas/test_result.py:13` — `execution_time: int | None`), so sending `null`/omitting the field is already supported end-to-end; no backend change is needed.

Why remove it: the tester has no control over the lifecycle (opens the page, walks away, comes back — the number is meaningless), the value is never actually used by any downstream feature today, and the UI real estate and visual noise are better spent on the per-step status picker from `plan-105-execution-per-step-status.md`.

---

## Scope

### In scope
- Delete the timer widget markup from the per-case card header
- Delete `elapsedSeconds`, `timerInterval`, `startTimer`, `stopTimer`, `resetTimer`, and any `formatTime` helper that exists solely for the timer
- Delete the auto-start, reset-on-switch, and stop-on-unmount calls
- Stop writing `execution_time` from the timer on the two submit paths — send the field as `undefined` so it is omitted from the JSON, letting the backend keep the existing `null` default
- Delete `.timer` / `.timer-value` CSS and any responsive overrides that target them
- Verify no other file references the removed state or functions

### Out of scope
- Removing the `execution_time` column or schema field on the backend — the field stays for existing rows and for any future automation that records real durations
- Adding a replacement "time spent" indicator of any kind (if needed, a separate plan)
- Touching the per-case navigation, the overall layout of the header, or any other widget in the same card
- Changing the run progress / counts / segmented progress bar

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-runs/TestRunExecutionView.vue` | Delete timer state, functions, markup block (696–724), CSS blocks (1144, 1153, 1529, 1533, 1608), auto-start/reset/unmount call sites (181–183, 272, 274, 276, 532); drop `execution_time` from the two submit payload constructions (~lines 202, 242) |
| (check) | any test that imports the view | Unit / e2e tests that assert on `execution_time` being sent must be updated or deleted |

### Key decisions

- **Delete `execution_time` from the payload, don't send `0`**: sending `0` would lie — the result did not take zero seconds, we simply did not measure it. `undefined` / omitted lets the backend store `null`, which is honest. `TestResultCreate.execution_time` is already optional so this is a no-op at the wire level.
- **Remove, do not hide**: commented-out or `v-if="false"` code rots. The removal is total — if the product ever wants a real timer back, it can be rebuilt around a different premise (e.g. server-side timestamps).
- **Keep the backend field**: existing `execution_time` values in the database are still meaningful history. This plan does not drop the column or the schema field — only the one UI that was feeding it bad data.
- **Keep `formatTime` only if it has other consumers**: if it is used elsewhere (e.g. in a "total run duration" label), leave it; otherwise delete it with the timer. Grep the file and the rest of `src/` before deleting.
- **No migration of the CSS**: the three `.timer` blocks are scoped to this view and not reused — they go away cleanly.

---

## Tasks

### Implementation
- [x] Delete `elapsedSeconds` and `timerInterval` refs from `src/views/test-runs/TestRunExecutionView.vue` (lines 53–54)
- [x] Delete `startTimer`, `stopTimer`, `resetTimer` function declarations (lines ~109–134)
- [x] Check whether `formatTime` is used anywhere else in the file or in `src/` — if not, delete it; if yes, leave it
- [x] Delete the call sites:
  - [x] `if (!timerInterval.value) startTimer()` block around line 181–183
  - [x] `resetTimer()` / `startTimer()` / `resetTimer()` calls around lines 272–276
  - [x] `stopTimer()` in the unmount/cleanup block around line 532
- [x] Delete the markup block at lines 696–724 (the `<div class="timer">` and everything inside it)
- [x] Delete the CSS rules `.timer` and `.timer-value` at each of the three locations (1144, 1153, 1529, 1533, 1608) including any responsive overrides
- [x] Remove `execution_time: elapsedSeconds.value` from the two submit payload constructions (~lines 202 and 242). Omit the key entirely rather than sending `0` or `null` from the client.
- [x] Repo-wide grep for `elapsedSeconds`, `startTimer`, `stopTimer`, `resetTimer` to confirm no stray references remain
- [x] Visually inspect the per-case card header — the layout that previously held the timer should close cleanly; if the header used a flex `justify-content: space-between` that depended on the timer for balance, add a small tweak so the remaining content sits correctly
- [x] Update or delete any unit/e2e test that asserted on the timer UI or on `execution_time` being in the submit payload

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc catches dangling references to the removed refs/functions)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke on the execution view: open a run, pick a case, switch between cases, submit a result, revisit it — nothing should reference the timer, nothing should throw

### Docs update (Phase 5)
- [x] `docs/01-product/features/test-execution.md` (or the run execution feature doc) — remove any line that described the stopwatch; note that `execution_time` is no longer captured from the UI
- [x] `docs/02-architecture/ARCHITECTURE.md` — only if the codemap mentioned the timer (unlikely; verify)
- [x] `docs/08-decisions/changelog.md` — record: removed manual stopwatch from execution view, `execution_time` omitted on client submit (backend field stays nullable and intact)
- [x] `docs/04-execution/tech-debt.md` — close any open item that mentioned the timer; optionally log "revisit whether to record real execution time via server-side timestamps" as a future idea
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map / api-schema update — nothing at those layers changes. The client simply stops sending one optional field.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A downstream feature (reports, analytics) relied on `execution_time` being set on new results | Medium | Backend field is nullable; existing reports must already tolerate `null`. Grep backend for `execution_time` consumers to confirm before merge. |
| A test asserts the timer markup or the submitted `execution_time` value | Medium | Unit/e2e sweep step; update or delete those assertions |
| Removing `formatTime` breaks an unrelated label | Low | Explicit grep for the function name before deleting |
| Header flex layout collapses without the timer balancing it | Low | Visual check post-removal; small CSS tweak if needed |
| Stakeholder expected a timer replacement | Low | Plan is explicitly "remove"; a replacement is out of scope and would be its own plan |

---

## Definition of done

- [x] No timer UI visible on `/test-runs/:id/execute`
- [x] No references to `elapsedSeconds`, `timerInterval`, `startTimer`, `stopTimer`, `resetTimer` remain in the codebase
- [x] New test results submitted from the UI omit `execution_time`; the backend stores `null` for that column on new rows
- [x] Existing test results still render correctly (their stored `execution_time` values are unaffected)
- [x] Header layout of the per-case card looks correct with the timer gone, in both light and dark mode
- [x] Unit and e2e tests pass
- [x] PR checklist completed
- [x] Docs updated
