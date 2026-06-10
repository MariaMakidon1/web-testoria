# Execution Plan: Dashboard Recent Test Runs — Fix Pass-Rate Percentage + Passed Green

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On the dashboard's **Recent Test Runs** list, render each run's pass rate as the correct percentage (not 1% when the run is 50% passed) with the canonical passed-green bar colour — matching the rest of the dashboard's "completed passed = green" visual language.

---

## Context

Since api-testoria plan-035, `TestRunProgress.pass_rate` is a **0..1 ratio** (`passed / (passed + failed + blocked + no_run)`), not a 0..100 percentage. The dashboard's Recent Test Runs row was never updated to match:

`src/views/dashboard/DashboardView.vue:564-573`
```vue
<div v-if="run.progress" class="run-progress">
  <ProgressBar
    :value="run.progress.pass_rate ?? 0"        <!-- expects 0..100, gets 0..1 -->
    :showValue="false"
    class="progress-mini"
  />
  <span class="progress-label"
    >{{ (run.progress.pass_rate ?? 0).toFixed(0) }}%</span     <!-- (0.5).toFixed(0) === "1" -->
  >
</div>
```

Effect: a run with a real 50% pass rate shows as a near-invisible bar labelled "1%". A 100% run shows "1%" too. The user's reported "incorrect percentage" on the dashboard is this unit mismatch.

Secondary issue: `ProgressBar` renders in PrimeVue's default blue. The rest of the dashboard (per-project breakdown, reports, plan-071 in flight for list view) is moving toward the canonical **passed green** (`RESULT_STATUS_COLORS.passed = "#22c55e"`) as the single source of truth for "passed" colour.

The formatting utility `formatPassRate(ratio)` in `src/utils/passRate.ts` already does the right conversion (ratio × 100, one decimal, `—` fallback). The dashboard just isn't using it here.

Related:
- api plan-035 — pass-rate unified as 0..1 ratio
- plan-048 — status colour tokens standardised
- plan-050 — dashboard overall pass-rate rendering (equal-weight average, `—` for null)
- plan-070 (in flight) — completed-only dashboard semantics
- plan-071 (in flight) — progress bar green on test-runs list (same colour fix pattern)

---

## Scope

### In scope
- Convert `run.progress.pass_rate` to percentage before passing to `<ProgressBar :value>` (multiply by 100)
- Replace the ad-hoc `(pass_rate ?? 0).toFixed(0) + "%"` label with `formatPassRate(run.progress.pass_rate)` from `src/utils/passRate.ts` (delivers correct percentage + `—` fallback)
- Colour the bar with `RESULT_STATUS_COLORS.passed` via the `ProgressBar` `color` binding — **always green, regardless of pass rate** (matches plan-050's "overall pass rate always in green" convention on the dashboard headline)
- **Scope discipline for Recent Test Runs entries:** the per-row bar reflects the run's own progress and is shown for any run in the list (planned/active/completed). The dashboard's aggregate KPIs are plan-070's responsibility and only consider completed runs. Verify during implementation that no aggregate/average computation in this section silently mixes non-completed runs.
- Handle `pass_rate === null` (runs with zero finalised results): render `—` as the label and either hide the bar or show an empty grey track — pick whichever matches plan-050's dashboard treatment of null values
- Unit test the Recent Test Runs row's rendered percentage and bar colour (always green)

### Out of scope
- Changes to the Recent Test Runs filter logic (which runs appear in the list) — plan-070 handles completed-only semantics elsewhere on the dashboard; Recent Test Runs intentionally lists recent runs regardless of status
- Backend changes to `TestRunProgress` shape
- Refactoring other callers that may still be using the old 0..100 assumption — grep during implementation and fix in this plan if trivial, otherwise list as tech debt
- Touching the main dashboard headline or per-project breakdown bars (already correctly using 0..100 percentages through their own computed paths)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/dashboard/DashboardView.vue` | (1) Import `RESULT_STATUS_COLORS` from `@/types/testResult` (already imported elsewhere in this file — verify). Import `formatPassRate` from `@/utils/passRate`. (2) In the Recent Test Runs block (lines ~564-573), change `:value` to `(run.progress.pass_rate ?? 0) * 100`. (3) Replace the label span with `formatPassRate(run.progress.pass_rate)`. (4) Bind `:color="RESULT_STATUS_COLORS.passed"` on the `<ProgressBar>`. (5) Handle null pass_rate gracefully (hide bar or render empty). |
| tests | `src/views/dashboard/__tests__/DashboardView.spec.ts` | Add/extend test: mount view with runs of known pass_rate ratios (0, 0.5, 1.0, null); assert label text and `ProgressBar :value` prop. |

### Key decisions

- **Fix at the render site, not by mutating `run.progress`.** The store holds the raw 0..1 ratio consistent with the backend contract; converting to percentage at the edge where a percentage is needed keeps the store canonical.
- **Use `formatPassRate()` rather than inlining.** One source of truth for "how do we show a pass rate string" — plan-050 already landed the helper.
- **Bar colour comes from `RESULT_STATUS_COLORS.passed`, same as plan-071.** Consistency with the test-runs list progress bar; same rationale ("the bar represents passed cases, not a health score").
- **Null handling: render `—` label, hide the bar.** Matches the dashboard's existing null-pass-rate convention (plan-050). A zero-width or grey bar would imply "0% passed", which is different from "no data".
- **No threshold colours.** As with plan-071, traffic-light red/amber/green is a different feature; the single-colour passed-green bar represents progress-of-passed, not a health score.

---

## Tasks

### Implementation
- [ ] Import `formatPassRate` from `@/utils/passRate` in `DashboardView.vue`
- [ ] Ensure `RESULT_STATUS_COLORS` is imported (likely already — verify)
- [ ] Update the `<ProgressBar>` binding in the Recent Test Runs block to `(run.progress.pass_rate ?? 0) * 100`
- [ ] Bind `:color="RESULT_STATUS_COLORS.passed"`
- [ ] Replace the label span with `formatPassRate(run.progress.pass_rate)`
- [ ] Handle null: `v-if="run.progress && run.progress.pass_rate !== null"` around the bar; render `—` label otherwise
- [ ] Grep for other callers treating `pass_rate` as 0..100 in views/components; fix trivially or add to tech debt
- [ ] Unit test: 0.0 → "0.0%", 0.5 → "50.0%", 1.0 → "100.0%", null → "—"; bar value matches 0/50/100
- [ ] Manual smoke: dashboard shows a run with 1-of-2 cases passed → label reads "50.0%", bar is half-green
- [ ] Manual smoke: dashboard shows a run with all cases `no_run` → label reads "—", no bar or empty track

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if any dashboard feature doc describes Recent Test Runs, note the canonical green + correct percentage
- [ ] `docs/08-decisions/changelog.md` — short entry: dashboard Recent Test Runs uses `formatPassRate` + passed green
- [ ] `docs/04-execution/tech-debt.md` — only if grep finds additional 0..100/0..1 mismatches out of scope of this plan
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Other callers on the dashboard also assume 0..100 and regress when the shared helper lands | Medium | Grep during implementation; fix any trivial additional sites in this plan, otherwise log as tech debt |
| Hiding the bar for null pass_rate shifts row height and looks jumpy | Low | Keep the container fixed-width; render an empty grey track with `visibility: hidden` on the bar fill if layout shift is visible |
| PrimeVue `ProgressBar :color` prop behaviour differs between versions | Very low | Pattern already proven on the dashboard (`breakdown-bar` uses the same approach via a `:deep(.p-progressbar-value)` rule). Reuse the approach if the prop path is flaky. |
| Visual regression in dark mode | Low | Passed green is defined as a static hex (`#22c55e`) — already legible on both themes in existing uses |

---

## Definition of done

- [ ] Recent Test Runs rows show the real percentage (e.g. 50.0% when half of the cases have passed, 100.0% when all executed cases passed, `—` when no data)
- [ ] The progress bar renders in passed green (`#22c55e`) at every pass-rate value — no red/amber tiers
- [ ] No row on Recent Test Runs shows the old `(ratio).toFixed(0) + "%"` output
- [ ] Grep confirms no aggregate/average pass-rate computation inside this section silently mixes non-completed runs (verified during implementation; any gap is fixed here or logged as tech debt)
- [ ] Unit tests cover 0/0.5/1.0/null pass_rate cases and assert bar colour is `RESULT_STATUS_COLORS.passed`
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
