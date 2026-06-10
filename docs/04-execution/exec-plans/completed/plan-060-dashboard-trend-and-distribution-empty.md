# Execution Plan: Fix empty "Pass Rate Trend" and "Test Results Distribution" on the dashboard

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

On `/` (Dashboard), the "Pass Rate Trend" line chart and "Test Results Distribution" doughnut chart render with real data instead of showing nothing. Root cause: both charts read `run.progress` from the runs list, but the backend's list endpoint does not return `progress` today. This plan wires the dashboard to the opt-in `?include=progress` projection added by api plan 036 and fixes a few related consumer-side bugs.

---

## Context

Both sections live in `src/views/dashboard/DashboardView.vue`.

### Distribution doughnut (blank)

```ts
// DashboardView.vue:103-120
const statusDistribution = computed(() => {
  const runs = filteredTestRuns.value;
  let passed = 0, failed = 0, blocked = 0, skipped = 0;

  runs.forEach((run) => {
    if (run.progress) {            // ← always false today
      passed += run.progress.passed;
      failed += run.progress.failed;
      blocked += run.progress.blocked;
      skipped += run.progress.skipped;
    }
  });

  return { passed, failed, blocked, skipped };
});
```

Every `run.progress` is `undefined` because `GET /test-runs` does not include `progress` on each item. The doughnut receives `[0, 0, 0, 0]` and renders a blank/empty ring.

### Trend line chart (blank / "No data")

```ts
// DashboardView.vue:156-176
const completedRuns = runs.filter(
  (r) => r.status === "completed" && r.progress && r.completed_at,  // ← filters out everything
);

if (completedRuns.length === 0) {
  return { labels: ["No data"], datasets: [{ data: [0], … }] };
}
```

Same root cause: `r.progress` never exists, `completedRuns` is always empty, the chart falls through to the "No data" branch.

### Secondary issues the fix exposes

- **`no_run` is missing from the distribution.** Once the doughnut sums real totals, it will ignore cases with status `no_run` (introduced by plan-054 / api plan 032), under-reporting scope.
- **Hard-coded colors** (`#22c55e`, `#ef4444`, `#f59e0b`, `#6b7280`) duplicate `--status-*` tokens from plan-048 and will drift if the tokens move again.
- **Lowercase labels** (`["passed", "failed", "blocked", "skipped"]`) — plan-059 introduces `statusLabel()` for exactly this rendering. The doughnut should use it.
- **Trend pass-rate math** currently recomputes `Math.round((stats.passed / stats.total) * 1000) / 10` inside the chart — works, but will diverge from api plan 035's unified `pass_rate` helper if anyone tweaks one side.

All of these are small; they're in scope because fixing only "data appears" and leaving the adjacent inconsistencies in place would be a near-guaranteed follow-up ticket.

---

## Scope

### In scope (page `/` only)

- On dashboard mount (and on project-selection change), fetch runs with `?include=progress` so each `run.progress` is populated
  - Easiest path: extend `testRunsApi.listTestRuns` to accept an `include` option; pass `"progress"` from `fetchAllRuns` / `fetchTestRuns` **only when called from the dashboard** (overload or new action — see Key decisions)
  - Preferred: add a dedicated store action `fetchAllRunsForDashboard(projectIds)` / `fetchRunsWithProgress(projectId)` that always passes `include=progress`, so non-dashboard callers are not affected
- Update `statusDistribution`:
  - Include `no_run` in the totals
  - Use `RESULT_STATUS_COLORS` (existing token-backed map) for the doughnut `backgroundColor` instead of hard-coded hex
  - Use `statusLabel(...)` (from plan-059) for the doughnut labels
- Update `trendData`:
  - Keep client-side weekly bucketing for now (server-side aggregation is a follow-up)
  - Use `run.progress.pass_rate` (0..1 ratio per api plan 035) scaled via `toPercent(...)` from plan-058 where a display percent is needed; but compute the weekly value as `weekPassed / weekTotal` (not an average of ratios, which would misweight weeks with few runs)
  - Guard against `progress.total === 0` (skip the week or render 0, documented)
- Ensure both charts show a graceful empty state when there is genuinely no data (e.g. first-time user, project with zero runs), instead of rendering zero-point shapes that look broken
- Unit tests for both computeds using fixture runs with populated `progress`
- E2E: seed a project with several completed runs (mixed statuses); open the dashboard; assert the doughnut has non-zero segments and the line chart has more than one data point

### Out of scope

- A dedicated dashboard trend / distribution backend endpoint (follow-up if latency becomes an issue)
- Any change to `/test-runs` list view, test-run detail, or execution pages
- Redesigning the dashboard widgets or adding new charts
- Real-time updates via Centrifugo — reload-on-project-change is sufficient
- Historical trend beyond the existing 6-week window
- Drill-down interactions on the charts (follow-up UX plan)
- Changes to the recent-runs list rendering (the `run.progress.pass_rate` usage there is already in scope of plan-058)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| api client | `src/api/testRuns.ts` | `listTestRuns(projectId, filters?, include?)` — accept `include: "progress"` and pass as a query param |
| store | `src/stores/testRuns.ts` | New action `fetchAllRunsForDashboard(projectIds)` that calls the API with `include=progress` and populates `allRuns` so existing computeds see `run.progress` (or add a separate `dashboardRuns` ref to keep concerns isolated — decision below) |
| views | `src/views/dashboard/DashboardView.vue` | `loadDashboardData` calls the new action instead of `fetchAllRuns` / `fetchTestRuns`; `statusDistribution` includes `no_run`, uses tokens + `statusLabel`; `trendData` uses `run.progress` / `toPercent`; empty-state handling for both charts |
| tokens | `src/views/dashboard/DashboardView.vue` | Replace the doughnut's hard-coded hex array with values read from `RESULT_STATUS_COLORS` |
| utils | re-use `src/utils/passRate.ts` (plan-058) and `src/utils/statusLabel.ts` (plan-059) | No new utils |
| tests | `tests/unit/views/DashboardView.spec.ts` (new or existing) | Given fixture runs with progress, computeds produce correct data; empty runs → empty-state data |
| e2e | `tests/e2e/dashboard.spec.ts` | Seeded scenario — doughnut has data, line chart has ≥ 2 points |

### Key decisions

- **Opt-in on the API call, not a store-wide change.** Adding `include=progress` to every `fetchAllRuns` call would slow down the runs list view. Isolate the extra cost to the dashboard's load path via a dedicated action.
- **Reuse the existing `allRuns` state vs a separate `dashboardRuns`.** Reusing `allRuns` means the dashboard's `filteredTestRuns` computed keeps working unchanged, but every page that consumes `allRuns` after the dashboard loaded will see the populated `progress` (harmless, but inconsistent). Compromise: keep reusing `allRuns`, accept the harmless overlap, and note that `progress` is opportunistically populated. A dedicated `dashboardRuns` state is logged as follow-up if the overlap becomes noisy.
- **Include `no_run` in the distribution.** The doughnut should reflect scope, not just executed cases. Without `no_run`, a newly-created run drops out of the chart entirely.
- **Use tokens, not hex.** `RESULT_STATUS_COLORS` from `src/types/testResult.ts` already has the right values post-plan-048. Consuming the map means a future token change in one place propagates to the chart automatically.
- **Use `statusLabel` for the doughnut legend.** Aligns with plan-059; no lowercase legend entries.
- **Weekly trend uses `weekPassed / weekTotal`, not average of per-run ratios.** An average of ratios misweights weeks where one run has 100 cases and another has 10. The existing code already does this correctly on the raw totals — keep it.
- **Scale to percent at the chart boundary.** The y-axis is labelled `%` and ticks are `value + "%"`. Keep it 0..100 on the chart axis; the weekly data point is computed as `(passed / total) * 100` rounded to 1 decimal (equivalent to `toPercent(passed / total)`).
- **Empty state is explicit.** When there are no completed runs with progress, render a visible "No data yet" message in the chart tile rather than a line chart of `[0]` — the current implementation's single-point chart looks like a bug.

---

## Tasks

### Implementation
- [ ] Confirm api plan 036 is merged or releasing with this plan; without it, the `?include=progress` request returns `progress: null` on every run and this plan has nothing to populate
- [ ] `src/api/testRuns.ts`:
  - [ ] Extend `listTestRuns` with an optional `include?: "progress"` parameter; pass `?include=progress` when set
- [ ] `src/stores/testRuns.ts`:
  - [ ] Add `fetchAllRunsForDashboard(projectIds: number[])` that calls the API with `include=progress` and writes to `allRuns`
  - [ ] Add `fetchRunsForDashboard(projectId: number)` equivalent for the single-project case
  - [ ] Leave existing `fetchAllRuns` / `fetchTestRuns` unchanged (other callers keep today's cost)
- [ ] `src/views/dashboard/DashboardView.vue`:
  - [ ] Replace `fetchAllRuns` / `fetchTestRuns` calls in `loadDashboardData` with the new dashboard-scoped actions
  - [ ] `statusDistribution`:
    - [ ] Initialise `no_run: 0` alongside passed / failed / blocked / skipped
    - [ ] Sum `run.progress.no_run` where present
    - [ ] Return the object with every status present today + `no_run`
  - [ ] `doughnutData`:
    - [ ] Labels via `RESULT_STATUSES.map(statusLabel)` (or an explicit ordered array passed through `statusLabel`)
    - [ ] Data in the same order as labels
    - [ ] `backgroundColor` built from `RESULT_STATUS_COLORS` (one hex per label)
  - [ ] `trendData`:
    - [ ] Keep weekly bucketing; keep `(weekPassed / weekTotal) * 100`; explicitly `toFixed(1)` for display
    - [ ] If no completed runs have progress, set `labels: []` / `datasets[0].data: []` and render a chart-level empty state via a `v-if` in the template
  - [ ] Template: when no trend data, show a "No completed runs yet" empty-state block instead of the chart
  - [ ] Template: when distribution totals are all zero, show a "No activity yet" empty-state block instead of the doughnut
- [ ] Unit tests with fixture runs having populated progress:
  - [ ] Distribution: sums across multiple runs including `no_run`
  - [ ] Distribution: all-zero when no runs have progress (regression guard for the fix)
  - [ ] Trend: groups by week correctly; computes per-week pass-rate on totals (not averaged ratios)
  - [ ] Trend: skipping a week with `total=0` — documented behaviour verified
  - [ ] Labels in the doughnut are Title-Case via `statusLabel`
  - [ ] Colors come from `RESULT_STATUS_COLORS`, not literals
- [ ] E2E:
  - [ ] Seed a project with at least 3 completed runs across ≥ 2 weeks; some passed, failed, blocked, no_run
  - [ ] Open the dashboard; assert the doughnut has non-zero segments and a legend with Title-Case labels
  - [ ] Assert the trend line has ≥ 2 data points
  - [ ] Switch project filter; assert charts reload with the new data
  - [ ] Seed a fresh project with zero runs; assert the empty-state messages render
- [ ] Manual: dark-mode rendering of both charts; legend readability; tooltip values

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — note the `include=progress` param used by the dashboard
- [ ] `docs/02-architecture/frontend/state-management.md` — document `fetchAllRunsForDashboard` and the intentional opt-in cost
- [ ] `docs/01-product/features/` — update the dashboard feature file (if present) to describe the charts' data source
- [ ] `docs/08-decisions/changelog.md` — record: fixed the blank dashboard charts; added dashboard-scoped store action; charts now use status tokens + `statusLabel`; trend weighted by totals
- [ ] `docs/04-execution/tech-debt.md` — log follow-ups: (a) dedicated `dashboardRuns` state if overlap is ever noisy, (b) server-side trend aggregation if client-side bucketing becomes slow, (c) drill-down interactions on the charts
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Api plan 036 ships without `no_run` support and the doughnut shows `undefined` segments | Low | Default `run.progress.no_run ?? 0` everywhere; guard in the computed |
| `fetchAllRunsForDashboard` overlaps with `fetchAllRuns` and double-fetches | Medium | Dashboard only calls the dashboard-scoped action; other views keep their existing action; a comment in the store documents the split |
| Dashboard becomes noticeably slower due to the extra include | Medium | Measure; api plan 036 caps at ≤ 3 SQL statements for a page; if latency is visible, reduce page size or add spinner state on charts only |
| Token-backed colors render poorly in dark mode | Low | Plan-048 already validated the tokens in dark mode; verify once more on the dashboard |
| `statusLabel` returns `"—"` for a label the chart library can't handle | Low | Guard: fallback to `RESULT_STATUSES[i]` if `statusLabel` returns the dash; unit-tested |
| Weekly bucketing uses browser local time and drifts across timezones | Low | Matches existing behaviour; documented; UTC-bucketing is a follow-up if product asks |
| Empty-state blocks change the dashboard layout (height) | Low | Match the existing chart tile height with the empty-state container; visual check in both themes |
| Someone assumes `allRuns` always has `progress` after this plan | Medium | Comment in the store; only the dashboard action populates progress; other views must still call `fetchRunProgress` for a specific run |

---

## Definition of done

- [ ] "Pass Rate Trend" chart renders a real line with ≥ 1 point whenever any completed run has progress
- [ ] "Test Results Distribution" doughnut renders non-zero segments whenever runs have progress
- [ ] Distribution includes `no_run`
- [ ] Doughnut labels are Title-Case via `statusLabel`; colors come from `RESULT_STATUS_COLORS`
- [ ] Trend weekly value = `weekPassed / weekTotal` (not an average of run ratios)
- [ ] Empty states are explicit copy ("No completed runs yet" / "No activity yet"), not zero-point charts
- [ ] Dashboard fetches use `?include=progress`; other views' fetches are unchanged
- [ ] Unit + e2e tests cover populated and empty scenarios
- [ ] Dark mode verified
- [ ] Docs updated; follow-ups logged
- [ ] PR checklist completed
