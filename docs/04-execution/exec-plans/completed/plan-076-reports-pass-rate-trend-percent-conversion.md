# Execution Plan: Reports Page — Correct Pass Rate % in Trend Chart + KPI Thresholds

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/reports`, render `pass_rate` as a real percentage (0–100) everywhere — the trend chart, the "Average Pass Rate" KPI, and the threshold-driven colour/badge logic — instead of treating the backend's 0..1 ratio as if it were already a percentage.

---

## Context

Since api-testoria plan-035, the backend emits `pass_rate` as a **0..1 ratio** (`passed / (passed + failed + blocked + no_run)`) across all analytics endpoints. The reports view was never updated to multiply by 100 at the rendering sites.

Reference backend response supplied by user (shape of `report-analytics.trend` during a quiet window):
```
{ "date": "2026-04-14", "passed": 0, "failed": 0, "blocked": 0, "no_run": 0, "total": 0, "pass_rate": null }
```
`pass_rate: null` is the correct "no data" signal when `total === 0`. When data exists, the backend returns e.g. `0.8` for 80%.

Bug sites in `src/views/reports/ReportDashboardView.vue`:

1. **`metrics.average_pass_rate`** (line 102)
   ```ts
   average_pass_rate: Math.round(a.summary.overall_pass_rate * 10) / 10,
   ```
   Rounds the 0..1 ratio to one decimal. Template at line 624 then renders `{{ metrics.average_pass_rate }}%` → a real 80% pass rate displays as **"0.8%"**.

2. **Threshold-driven KPI classes and badges** (lines 617-621, 710, 741)
   ```ts
   'text-success': metrics.average_pass_rate >= 80,
   'text-warning': metrics.average_pass_rate >= 60 && metrics.average_pass_rate < 80,
   'text-danger': metrics.average_pass_rate < 60,
   ```
   With the value being 0..1, every comparison degenerates — the KPI is effectively always flagged red (and any conditional banners at 710/741 behave inversely to intent).

3. **Trend chart series** (line 117)
   ```ts
   pass_rate: p.pass_rate != null ? Math.round(p.pass_rate * 10) / 10 : 0,
   ```
   Kept as a 0..1 ratio. Chart.js plots the "Pass Rate" line at ~0 every day, alongside the "Total Tests" line that dwarfs it. Visual = flat zero, which is the user-reported symptom.

All three defects are the same mistake at different rendering sites: dividing the model-layer ratio into presentation code without the `* 100` conversion.

Related prior work:
- api plan-035 — pass-rate unified as 0..1 ratio
- plan-050 — dashboard headline pass-rate (correct conversion there)
- plan-074 (in flight) — same fix for Recent Test Runs bar
- `src/utils/passRate.ts` already exports `formatPassRate(ratio)` and `toPercent(ratio)` — the single source of truth we should reach for

---

## Scope

### In scope
- Multiply by 100 when converting `overall_pass_rate` into `metrics.average_pass_rate`
- Multiply by 100 on every trend point's `pass_rate` before it reaches Chart.js
- Preserve `null` semantics in the trend: days with `pass_rate === null` should be **gaps** in the line (Chart.js `null` or `NaN` data point), not forced zeros — otherwise quiet periods falsely drag the line down
- **Average Pass Rate KPI: completed runs only, always green.** The backend's `overall_pass_rate` must be sourced from completed test runs only (shipped by api plan-039). Verify at integration time that the value reaching `ReportDashboardView` is the completed-only figure; if the frontend is still accidentally receiving a mixed-status number, add an issue and block merge of this plan on the backend fix. Colour the "Average Pass Rate" KPI in **canonical passed green** (`RESULT_STATUS_COLORS.passed = "#22c55e"`) at every value — matches plan-050's dashboard headline "always in green" convention and plan-071 / plan-074's progress-bar treatment.
- **Drop the red/amber/green threshold classes** on the KPI (lines 617-621, 710, 741 in `ReportDashboardView.vue`). The traffic-light semantic implied "quality grade" which the plan-050 decision already moved away from. Threshold-driven conditional banners can stay if they communicate information (e.g., "Below 80% — investigate"), but the KPI number and its colour always render as passed green. Confirm with the user if an explicit threshold banner is wanted; default in this plan is to remove the conditional branches.
- Use `formatPassRate()` / `toPercent()` from `src/utils/passRate.ts` for string output where applicable; keep numeric values numeric for chart datasets
- Unit test: known ratios (0, 0.5, 0.8, 1.0, null) produce correct chart data + KPI value; KPI colour is green regardless of value

### Out of scope
- Backend shape change (ratio stays canonical)
- Backend "completed runs only" semantics — delivered by api plan-039; this plan depends on it
- Broader refactor to push ratio→percent conversion into a single API-adapter layer (tempting but crosses many files; tracked as tech debt)
- Redesign of the trend chart (axis range, colours, tooltips beyond the value fix)
- Dashboard, Recent Test Runs, list view, or other views — covered by plan-050 (already correct) and plan-074 (in flight)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/reports/ReportDashboardView.vue` | (1) Line 102: `average_pass_rate: toPercent(a.summary.overall_pass_rate) ?? 0` (keep one-decimal rounding if the UI shows fractional percents; `toPercent` already returns `ratio * 100`). (2) Line 117: map trend points to `pass_rate: p.pass_rate != null ? toPercent(p.pass_rate) : null` — propagate `null` for empty days. (3) Trend chart dataset (line 163): pass the array as-is (now containing 0..100 or `null`); confirm Chart.js `spanGaps` option is set or add it so the line gaps cleanly across `null` days. Set the line colour to `RESULT_STATUS_COLORS.passed` for visual consistency with the KPI. (4) **Remove** the threshold class bindings at lines 617-621; replace with a single static class that uses passed green for the KPI number. (5) **Remove or neutralise** the conditional banners at lines 710 / 741 — confirm with user whether to keep informational banners; default: remove. |
| utilities | `src/utils/passRate.ts` | No change expected. Verify `toPercent(ratio)` returns `ratio * 100` (or null). If it currently returns a formatted string, use a small inline `(ratio != null ? ratio * 100 : null)` instead. |
| tests | `src/views/reports/__tests__/ReportDashboardView.spec.ts` | (a) `metrics.average_pass_rate` equals 80 when backend returns `overall_pass_rate: 0.8`. (b) Threshold class is `text-success` at ratio 0.85, `text-warning` at 0.70, `text-danger` at 0.40. (c) Trend dataset contains `null` for empty days, `50` for `pass_rate: 0.5`. (d) Quiet window (all `pass_rate: null`) renders the empty-state/no-data branch. |

### Key decisions

- **Preserve `null` through the trend, don't coerce to `0`.** The current `? ... : 0` collapses "no data" into "0% pass rate". That visually implies a failing day. Using `null` + Chart.js `spanGaps: true` draws a gap between real data points, which is the honest representation.
- **Use `toPercent()` from the shared util rather than inline `* 100`.** Keeps the conversion consistent with plan-050's dashboard work. If the helper returns a string today, extend it to return a `number | null` variant (small, localised change) or drop it here and inline — I prefer a numeric helper so chart datasets stay numeric.
- **Completed runs only is a backend responsibility, enforced here by contract check.** The "Average Pass Rate" KPI must only reflect completed runs. api plan-039 delivers this at the backend; this plan does not re-filter on the frontend (which would be error-prone and redundant). Instead, we add an integration smoke test: seed one completed run and one active run in a test project, fetch the report, and assert the active run's results do not leak into `overall_pass_rate`. If that test fails, block on api plan-039 rather than patching the frontend.
- **Drop the traffic-light thresholds (60/80).** Consistent with plan-050's "overall pass rate always green" treatment on the dashboard and plan-071 / plan-074's progress-bar decisions. Health-grade indicators are a separate product concept and can be added later if users actually ask for them. Flagging this explicitly: it's a UX change, not just a bug fix.
- **KPI colour is always passed green** (`RESULT_STATUS_COLORS.passed`). The number itself still changes; only the colour stays constant.
- **Trend line colour moves to passed green too**, matching the KPI. (Previously `#3b82f6` blue.) Consistent palette across the reports page.
- **Empty-state branch at line 126 already handles `trendData.length === 0`.** With the `filter((p) => p.total > 0)` at line 112, an all-quiet response hits this branch and renders "No data". Keep as-is.

---

## Tasks

### Implementation
- [ ] Verify (or add) a numeric `toPercent(ratio: number | null): number | null` in `src/utils/passRate.ts`
- [ ] Update `metrics.average_pass_rate` derivation in `ReportDashboardView.vue` to use the percent value (line 102)
- [ ] Update trend point mapping to return `number | null` in percent (line 117)
- [ ] Ensure Chart.js line dataset is configured with `spanGaps: true` so gaps render cleanly; set line colour to `RESULT_STATUS_COLORS.passed`
- [ ] Remove threshold class bindings at lines 617-621; apply static passed-green colour to the KPI number
- [ ] Remove or neutralise conditional banners at lines 710 / 741 (flag to user if any should survive as informational)
- [ ] Integration smoke: seed one completed + one active run, fetch report, assert active run does not contribute to `overall_pass_rate` (relies on api plan-039)
- [ ] Unit tests per the test table, plus: KPI colour is passed green at ratios 0.0, 0.5, 0.8, 1.0
- [ ] Manual smoke on dev server:
  - [ ] Backend returns `overall_pass_rate: 0.8` → KPI shows "80.0%" / "80%" in passed green
  - [ ] Trend with a real 50% day renders at y=50, not y=0.5; line is green
  - [ ] Quiet window (all `pass_rate: null`) → chart shows "No data" branch
  - [ ] Mixed window (some data, some null) → line renders with gaps on null days
  - [ ] Active/planned runs do not affect the "Average Pass Rate" KPI (completed-only contract holds end-to-end)

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if a reports feature doc exists, note the corrected KPI + trend behaviour
- [ ] `docs/08-decisions/changelog.md` — short entry: reports view now converts pass_rate ratio to percent at render; null days render as chart gaps
- [ ] `docs/04-execution/tech-debt.md` — add "unify ratio→percent conversion at API-adapter layer" as new debt (covers reports + dashboard + list in one place)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `toPercent` helper already formats to string → mixing string into chart data breaks Chart.js | Low | Verify the helper's return type before use; if it returns string, add a numeric sibling or inline the conversion. Tests catch this immediately. |
| Chart.js version in use doesn't support `spanGaps` as expected | Low | Fall back to filtering out null days before the map; the trade-off is a denser line that hides quiet periods, but the numeric axis will still be correct |
| Regressions in the "No data" empty state when all points are null | Low | Unit-test the all-null case explicitly; empty-state branch at line 126 should still fire |
| Threshold breakpoints (60/80) feel wrong to the user once they actually activate | Medium | Out of scope for this plan; log as a follow-up product question if feedback comes in |
| Other reports sub-widgets (not listed) also consume `pass_rate` as ratio | Medium | Grep `ReportDashboardView.vue` and `src/stores/reports.ts` during implementation; fix trivial sites in-plan, otherwise add to tech debt |

---

## Definition of done

- [ ] "Average Pass Rate" KPI on `/reports` shows a 0–100 percentage (e.g. "80.0%" for a ratio of 0.8)
- [ ] KPI value is rendered in canonical passed green (`#22c55e`) at every percentage — no red/amber/green traffic light
- [ ] KPI reflects only completed runs (verified by integration smoke, depends on api plan-039)
- [ ] Trend chart "Pass Rate" line plots on a 0–100 y-axis with real values in passed green; days with `pass_rate: null` render as gaps, not forced zeros
- [ ] Backend response matching the user's example (all `pass_rate: null`) renders the "No data" empty state branch
- [ ] Unit tests cover 0 / 0.5 / 0.8 / 1.0 / null conversions and assert KPI + trend-line colour is passed green at every value
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
