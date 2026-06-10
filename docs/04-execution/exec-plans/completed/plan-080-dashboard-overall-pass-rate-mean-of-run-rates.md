# Execution Plan: Dashboard Overall Pass Rate = Mean of Run Rates

**Date**: 2026-04-22
**Author**: gabi
**Status**: In Progress

---

## Goal

Align the Dashboard "Overall Pass Rate" tile with the new backend semantic (plan-041): average of each completed run's own pass rate, not a weighted passed/total ratio. Drop the `passed_results` / `total_results` fields added to `ProjectStatsItem` in plan-079.

---

## Context

Plan-079 introduced raw-count fields so the frontend could compute a weighted cross-project overall (`sum(passed)/sum(total)`). The user has since clarified that pass rate should be the **arithmetic mean of completed runs' pass rates** — a different formula that gives per-run equal weight. Under the new rule, the raw-count fields are dead weight.

---

## Scope

### In scope
- Remove `passed_results` / `total_results` from `src/types/project.ts`
- `DashboardView.overall`: compute from `filteredTestRuns.filter(completed && progress.pass_rate != null).map(r => r.progress.pass_rate).mean()`
- Keep the Select Run filter behaviour from plan-079 — unchanged
- Keep per-project breakdown rows consuming `s.pass_rate` (backend value is now the new semantic automatically)

### Out of scope
- Reports page — backend `overall_pass_rate` carries the new semantic; no view change
- Pass-rate trend chart — still per-week aggregation from `run.progress`

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/project.ts` | Drop `passed_results`, `total_results` |
| views | `src/views/dashboard/DashboardView.vue` | Replace weighted overall calc with mean of completed-run rates; drop the bulk-stats-driven overall path |

### Key decisions

- **Use run-level data, not bulk stats.** The overall under the new rule is `mean(run.progress.pass_rate)` across all completed runs in scope. That data is already in `testRunsStore.allRunsFlat` for the trend chart — no extra fetch, no schema round-trip.
- **Per-project breakdown unchanged.** Backend `s.pass_rate` now carries mean-of-run-rates automatically; the breakdown row already just displays that number.

---

## Tasks

### Implementation
- [ ] Drop fields from `ProjectStatsItem` type
- [ ] Rewrite `passRateData.overall` in `DashboardView.vue`
- [ ] Remove the now-unused `totalPassed` / `totalResults` reducers

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes

### Docs update
- [ ] `docs/06-generated/api-schema.md` — update `ProjectStatsItem` shape
- [ ] `docs/01-product/features/010-reports-dashboard.md` — rewrite the "Overall Pass Rate card" section to describe mean-of-run-rates
- [ ] `docs/08-decisions/changelog.md` — entry explaining the semantic flip and that plan-079's fields were reverted
- [ ] Plan moved to `completed/`

---

## Definition of done

- [ ] Dashboard overall matches mean of completed-run pass rates in scope
- [ ] Raw-count fields removed from types + schema doc
- [ ] Tests + lint + build green
