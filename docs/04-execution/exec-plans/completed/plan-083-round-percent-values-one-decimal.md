# Execution Plan: Round All Percent Values to One Decimal

**Date**: 2026-05-08
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Every percent value the user sees — Dashboard tiles, Reports KPIs, per-project breakdowns, run progress bars, list columns, chart axes, tooltips, doughnut leader-line labels, exported PDF/Excel — renders with exactly **one decimal place** (e.g., `87.5%`), driven by a single `formatPassRate` helper. No site computes percentages inline.

---

## Context

`pass_rate` lands from the API as a 0..1 ratio (api plan 035) but render sites each convert and round on their own. `DashboardView` rounds with `Math.round(x * 1000) / 10`, `ReportDashboardView` does the same dance twice for the KPI and the trend, `TestRunListView` and `ProjectDetailView` still treat `pass_rate` as a percent in places, the doughnut leader-line plugin rounds with its own `toFixed(1)`, and the tech-debt entry "Migrate remaining pass-rate sites to formatPassRate" (plan-058 follow-up) has been open since 2026-04-13. Result: the same value can appear as `87.5%` in the Dashboard tile, `87.5%` in the Reports KPI, but `87.51%` in the trend tooltip and `87%` in a chart label.

Pairs with backend plan 044, which rounds every `pass_rate` ratio at the API response boundary to 3 decimals (= 1 decimal of percent). Once both ship, the wire value is the source of truth and the UI just formats — no risk of two surfaces disagreeing.

This plan also closes the long-standing tech-debt entry by routing every render site through `formatPassRate`.

---

## Scope

### In scope

- Single helper `formatPercent(ratio, { decimals = 1, fallback = "—" })` in `src/utils/passRate.ts` — already exists as `formatPassRate`. Confirm its default is 1 decimal, then make it the only path.
- Audit and convert every site that currently formats a percent inline. Targets confirmed by grep before this plan was written:
  - `src/views/dashboard/DashboardView.vue` — tile + per-project breakdown rows
  - `src/views/reports/ReportDashboardView.vue` — KPI tile, trend tooltip values, automation-coverage doughnut label, insights threshold checks (`metrics.automation_coverage < 50` etc. — these compare against numbers so a *value* is needed, not a string; expose a sibling `toPercentRounded(ratio, decimals=1)` that returns a `number | null` for these cases)
  - `src/views/test-runs/TestRunListView.vue` — pass-rate column
  - `src/views/test-runs/TestRunDetailView.vue` — header / progress
  - `src/views/projects/ProjectDetailView.vue` — pass-rate stat (the offender that currently treats the raw value as a percent — see tech-debt entry)
  - `src/components/test-runs/TestRunProgressBar.vue` — segmented bar percentage label
  - `src/components/charts/DoughnutChart.vue` — leader-line label `(value).toFixed(1)` is already 1 decimal, but should still flow through the same helper for consistency
  - `src/components/reports/PerProjectBreakdown.vue` — already uses `formatPassRate`, confirm
  - `src/composables/useExcelExport.ts` and `src/composables/usePdfExport.ts` — pass-rate cells in the exported file
- Update `src/utils/passRate.ts`:
  - Confirm `toPercent(ratio)` returns the raw number (no rounding) — this stays as the conversion primitive
  - Add `toPercentRounded(ratio, decimals = 1): number | null` — for the small number of sites that need a *number* (insight-threshold compare, chart-axis ticks)
  - `formatPassRate(ratio, opts)` already returns the rounded *string* with `decimals = 1` default — keep
  - Once api plan 035 is confirmed live everywhere AND api plan 044 ships, **remove the `> 1.5` legacy clamp** in `toPercent` and the warning log (it was a defensive transitional check, no longer relevant)
- Update tests:
  - Existing unit tests that assert specific number renderings (e.g., `'87.5%'`) stay; failing assertions get the new format
  - New `tests/unit/utils/passRate.spec.ts` cases: `toPercentRounded(0.875)` → `87.5`, `toPercentRounded(0.123456)` → `12.3`, `toPercentRounded(null)` → `null`, `toPercentRounded(0.999)` → `99.9`
  - Snapshot/render tests on the affected views, asserting the rendered text matches `/^\d+\.\d%$/` or `"—"`
- E2E test: load `/`, `/reports`, `/test-runs`, a project detail, a run detail; assert no rendered percent has more than 1 decimal place (`page.locator(':text-matches("\\d+\\.\\d{2,}%")')` should match nothing).
- Resolve the tech-debt entry "Migrate remaining pass-rate sites to formatPassRate" — move to Resolved.

### Out of scope

- Changing the API wire format (still ratio 0..1, rounded to 3 decimals — see api plan 044). The frontend stays as the multiply-by-100 layer.
- Internationalisation — `formatPassRate` returns `"87.5%"` regardless of locale (matching current behaviour). Localised formatting is a separate plan.
- Chart axis titles like "Pass Rate %" — these are labels, not values; no change.
- The existing `defensive > 1.5` clamp in `toPercent`: leave in place until api plan 035 has been live for ≥ 2 weeks AND api plan 044 has shipped. Removal happens in a follow-up cleanup plan, not here, so the rollout window is preserved.
- Two-decimal precision in tooltips — explicitly rejected per the plan-question outcome (1 decimal everywhere).
- Status-distribution percentages computed locally for the leader-line plugin from arbitrary chart datasets — those aren't pass rates and stay on `(value / sum * 100).toFixed(1)` for the slice percentages (still 1 decimal).
- The `automation_coverage` calculation on `ReportDashboardView` (`Math.round(automated / total * 1000) / 10`) — flows into a number-comparison insight. Convert to `toPercentRounded` for consistency, no behaviour change.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| utils | `src/utils/passRate.ts` | Add `toPercentRounded(ratio, decimals = 1): number \| null`. Confirm `formatPassRate` default `decimals = 1`. Keep `toPercent` raw |
| views | `src/views/dashboard/DashboardView.vue` | Replace inline `Math.round(x * 1000) / 10 + '%'` with `formatPassRate(x)` for the headline tile and per-project breakdown rows |
| views | `src/views/reports/ReportDashboardView.vue` | Replace the two inline `Math.round((toPercent(...) as number) * 10) / 10` blocks with `toPercentRounded` (when feeding a number to insight checks) and `formatPassRate` (for rendered strings). Trend tooltip values use `formatPassRate` |
| views | `src/views/test-runs/TestRunListView.vue` | Replace inline pass-rate format with `formatPassRate(run.progress?.pass_rate)` |
| views | `src/views/test-runs/TestRunDetailView.vue` | Same — header summary line and progress block |
| views | `src/views/projects/ProjectDetailView.vue` | Fix the legacy bug where the raw ratio is treated as a percent (the existing tech-debt entry); replace with `formatPassRate(stats.pass_rate)` |
| components | `src/components/test-runs/TestRunProgressBar.vue` | Bar label uses `formatPassRate` |
| components | `src/components/charts/DoughnutChart.vue` | Leader-line plugin keeps its slice-percent math (not a pass rate) but routes the final `toFixed(1)` through a small `formatSlicePercent(value, total)` helper for symmetry; documented as "slice percent, not pass rate" |
| components | `src/components/reports/PerProjectBreakdown.vue` | Already uses `formatPassRate` — no change, just verified |
| composables | `src/composables/useExcelExport.ts` | Pass-rate cell value uses `formatPassRate` (for display cells) or stores the raw number with `numFmt: '0.0%'` (for spreadsheet-native percent formatting). Pick one — recommend `numFmt` so users can sort numerically |
| composables | `src/composables/usePdfExport.ts` | Pass-rate text cells use `formatPassRate` |
| tests | `tests/unit/utils/passRate.spec.ts` | Add cases for `toPercentRounded` |
| tests | `tests/unit/views/*.spec.ts` (where they exist) and store snapshot tests | Update assertions to match the unified format |
| tests | `tests/e2e/percent-rounding.spec.ts` | New: visit each page, assert no rendered percent has > 1 decimal |
| docs | `docs/06-generated/api-schema.md` | Note the new `toPercentRounded` helper; update the `RunAnalyticsItem.pass_rate` description to reference the api 044 server-side rounding |
| docs | `docs/01-product/features/010-reports-dashboard.md` | Update the Overall Pass Rate / trend / automation-coverage sections to note 1-decimal rendering |

### Key decisions

- **Single helper, two flavours.** `formatPassRate` returns a string for direct rendering; `toPercentRounded` returns a `number | null` for sites that compare against thresholds (`< 50`, `>= 80`). Same rounding rule under the hood (`Math.round(x * 10) / 10`). Splitting into two avoids parsing strings back into numbers.
- **No silent localisation.** `formatPassRate` deliberately uses `toFixed(1) + "%"` — same as today. Localising the decimal separator is a different conversation; this plan keeps the contract identical to the existing helper.
- **Excel export uses `numFmt`, not a formatted string.** Spreadsheets handle percent formatting natively (`'0.0%'` format, value stored as ratio). Users get sort-by-pass-rate for free. PDF export keeps the formatted string since PDFs are static.
- **Defensive `> 1.5` clamp stays for now.** Removing it requires api plan 035 to be live everywhere AND api plan 044 to be shipped. Both are conditions for a follow-up cleanup plan; out of scope here so we don't accidentally leave a window where a stale unrounded value bypasses the helper unchecked.
- **Doughnut leader-line slice percent is NOT a pass rate.** Slice = `value / sum * 100`. Renaming the local helper makes that distinction explicit so the next reader doesn't accidentally route slice math through `formatPassRate(ratio)` (which expects 0..1).
- **API rounding is the source of truth, not the helper.** Once api plan 044 ships, `Math.round(0.875 * 1000) / 10 === 87.5` regardless of which UI surface does the math, because the server only ever sends `0.875`. The frontend rounding step becomes a defence-in-depth safety net rather than the primary source of consistency.

---

## Tasks

### Implementation
- [ ] Add `toPercentRounded(ratio, decimals = 1): number | null` to `src/utils/passRate.ts`; confirm `formatPassRate` default
- [ ] Replace inline pass-rate formatting in:
  - [ ] `src/views/dashboard/DashboardView.vue`
  - [ ] `src/views/reports/ReportDashboardView.vue` (KPI, trend, automation, insights)
  - [ ] `src/views/test-runs/TestRunListView.vue`
  - [ ] `src/views/test-runs/TestRunDetailView.vue`
  - [ ] `src/views/projects/ProjectDetailView.vue` (also fixes the legacy ratio-as-percent bug)
  - [ ] `src/components/test-runs/TestRunProgressBar.vue`
  - [ ] `src/components/charts/DoughnutChart.vue` (slice helper rename, no behaviour change)
- [ ] Update `src/composables/useExcelExport.ts` to store ratio + `numFmt: '0.0%'`
- [ ] Update `src/composables/usePdfExport.ts` to use `formatPassRate` for text cells
- [ ] Add `tests/unit/utils/passRate.spec.ts` cases for `toPercentRounded`
- [ ] Update affected store/view unit tests to match the unified format
- [ ] Add `tests/e2e/percent-rounding.spec.ts` asserting no `\d+\.\d{2,}%` text appears on `/`, `/reports`, `/test-runs`, `/projects/:id`, `/test-runs/:id`

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (vue-tsc strict)
- [ ] `npm run test:e2e -- percent-rounding.spec.ts` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — note the rendering rule (UI is server-rounded, formatted at render via `formatPassRate`)
- [ ] `docs/01-product/features/010-reports-dashboard.md` — update Overall Pass Rate / trend / automation sections to note 1-decimal rendering
- [ ] `docs/01-product/features/<dashboard feature file if it exists>` — same
- [ ] `docs/04-execution/tech-debt.md` — **move** "Migrate remaining pass-rate sites to formatPassRate" (plan-058 follow-up) to **Resolved** with date 2026-05-08; reference plan-083
- [ ] `docs/08-decisions/changelog.md` — plan-083 entry: 1 decimal everywhere via `formatPassRate`/`toPercentRounded`, paired with api plan 044
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A site previously formatted as 2 decimals visibly shifts to 1 decimal mid-session | Certain | That's the intent. Single-decimal everywhere is the rule. No mitigation needed |
| `ProjectDetailView` legacy bug fix changes a stat that QA/screenshots had memorised | Low | Add a one-line note in the changelog identifying the fix; flag in PR description so reviewers know it isn't a regression |
| Excel `numFmt: '0.0%'` displays as `0.875` (raw) in older spreadsheet apps that don't honour the format | Low | Tested with Excel 365 + LibreOffice + Google Sheets in the existing export pipeline. Fallback is to revert that one composable to formatted strings — net cost: lose sort-by-rate |
| E2E percent regex over-matches dates / numeric labels | Medium | Restrict to `<span>`/`<td>` containing `%` directly; or use specific test-id attributes added to render sites |
| `toPercentRounded` returning `null` for `null` input breaks an insight threshold compare | Low | Insight checks already guard against `null` values; new helper preserves that contract |
| Defensive `> 1.5` clamp in `toPercent` masks an actual data bug post-rounding | Low | Clamp stays unchanged in this plan; any masking behaviour is unchanged from today. Removal is the follow-up plan once api plan 044 has been live |

---

## Definition of done

- [ ] Every rendered percent on `/`, `/reports`, `/test-runs`, `/test-runs/:id`, `/projects/:id` is exactly one decimal place (verified by E2E regex test)
- [ ] No site formats `pass_rate` inline — `grep -nrE 'Math\.round\(.*pass_rate' src/` returns nothing
- [ ] `formatPassRate` and `toPercentRounded` are the only conversion paths from ratio to percent
- [ ] Excel exports store ratio + `numFmt: '0.0%'`; opening in Excel/Sheets renders correctly and is sortable
- [ ] PDF exports show 1-decimal pass-rate strings
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [ ] E2E percent-rounding spec passes
- [ ] `ProjectDetailView` legacy ratio-as-percent bug is fixed
- [ ] Tech-debt "Migrate remaining pass-rate sites" entry moved to Resolved
- [ ] PR checklist completed
- [ ] Docs updated
