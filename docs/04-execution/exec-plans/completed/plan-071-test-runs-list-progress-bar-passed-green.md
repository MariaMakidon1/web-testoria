# Execution Plan: Test Runs List — Progress Bar Uses Passed Green

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs`, colour the per-row progress bar with the canonical **passed green** (`RESULT_STATUS_COLORS.passed`) instead of the current traffic-light scheme that shows red for any run under 70% — which is almost every run that has just started.

---

## Context

Today `src/views/test-runs/TestRunListView.vue:173` computes the bar colour with a 3-tier threshold:

```ts
function getProgressColor(passRate: number): string {
  if (passRate >= 90) return "#22c55e"; // green
  if (passRate >= 70) return "#f59e0b"; // amber
  return "#ef4444";                     // red (same as failed)
}
```

Combined with `calculatePassRate(progress) = passed / total`, a brand-new run with 1 of 2 cases passed renders a **red** bar at 50%. Users (correctly) read the red band as "failing" when in reality the only result so far is passed and the other case just hasn't been executed yet.

The bar on the list row represents **how much of the run has passed**, not a health score. Semantically it should match the `passed` swatch. The canonical green already lives in `src/types/testResult.ts:74` (`RESULT_STATUS_COLORS.passed = "#22c55e"`) and is the single source of truth established in plan-048 (status colour standardisation across CSS vars, TS constant, PDF RGB, Excel ARGB).

Related:
- plan-048 — status colour tokens standardised (completed 2026-04-15)
- plan-050 — dashboard overall pass-rate equal-weight average (completed 2026-04-15)
- plan-070 (in flight) — test run lifecycle + completed-only dashboard semantics

---

## Scope

### In scope
- Replace `getProgressColor()` in `TestRunListView.vue` with a constant reference to `RESULT_STATUS_COLORS.passed`
- Remove the unused threshold constants and the helper if nothing else consumes it
- Confirm the list's bar behaviour still reads well when `progress.total === 0` (empty run) — render a 0% bar in the same passed-green colour, not red

### Out of scope
- Redesigning the list progress bar as a multi-segment stacked bar (like `TestRunProgressBar.vue` used on the detail view). That's a larger UX change with its own layout/width implications.
- Touching `TestRunProgressBar.vue` or the progress bars on detail/execution views (they already use segmented result-status colours)
- Changing the pass-rate numeric label next to the bar
- Dashboard or reports chart colours

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/test-runs/TestRunListView.vue` | Delete `getProgressColor()`; import `RESULT_STATUS_COLORS` from `@/types/testResult`; pass `RESULT_STATUS_COLORS.passed` to the `<ProgressBar>` `color` binding. Remove the `/* Progress bar colors based on pass rate */` CSS comment block if it covers nothing else. |
| tests | `src/views/test-runs/__tests__/TestRunListView.spec.ts` (new or updated) | Assert the progress bar renders with the passed colour across pass-rate ranges (0%, 50%, 100%, empty progress) |

### Key decisions

- **Use `RESULT_STATUS_COLORS.passed` as the single source** rather than duplicating a hex literal — keeps us aligned with plan-048's "one source of truth" for status colour.
- **Drop the threshold logic entirely** rather than retuning the ranges. A "run health" heat map is a different feature; conflating it with run progress is what caused the bug.
- **Empty/zero state stays green.** An empty bar is visually dominated by the track colour anyway; switching to grey for `total === 0` would introduce a new code path for a trivial win.

---

## Tasks

### Implementation
- [ ] Import `RESULT_STATUS_COLORS` in `TestRunListView.vue`
- [ ] Replace the `:color` binding with `RESULT_STATUS_COLORS.passed`
- [ ] Delete `getProgressColor()` function and its call site
- [ ] Remove dead CSS block if no longer referenced
- [ ] Update/add unit test for the progress column colour
- [ ] Manual smoke check in dev server: rows with 0%, 50%, 100% all render green

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if a test-runs-list feature doc describes the traffic-light behaviour, correct it
- [ ] `docs/08-decisions/changelog.md` — short entry noting the rationale (progress bar represents passed cases, not a health score)
- [ ] `docs/04-execution/tech-debt.md` — no debt expected; add a line only if residual threshold logic remains
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Users who relied on the red/amber/green signal as an at-a-glance "health" view lose information | Low | The pass-rate percentage is still shown next to the bar; a follow-up plan can add an explicit health indicator if the signal is missed |
| Another component imports `getProgressColor` | Very low | It's defined inline in the view; a quick grep confirms no imports exist |
| Dev-server smoke test misses the 0/0 empty-run edge case | Low | Add it to the unit test explicitly |

---

## Definition of done

- [ ] Every row on `/test-runs` renders the progress bar in `#22c55e` (passed green), regardless of pass rate
- [ ] No `#ef4444` / `#f59e0b` literals remain in `TestRunListView.vue`
- [ ] Unit test covers 0%, 50%, 100%, and empty-progress cases
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
