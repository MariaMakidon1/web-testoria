# Execution Plan: Weighted Overall Pass Rate + Dashboard Run Filter

**Date**: 2026-04-22
**Author**: gabi
**Status**: In Progress

> **Lifecycle**: Active while in progress; move to `completed/` once all DoD items are checked off.

---

## Goal

Fix the incorrect "Overall Pass Rate" aggregation on the Dashboard (equal-weight mean across projects → sum/sum weighted), rename the Reports page label to match the real semantic, and add a "Select Run" filter on the Dashboard so metrics can be scoped to a single run.

---

## Context

On the Dashboard, `passRateData.overall` is the arithmetic mean of per-project pass rates, which over-weights low-volume projects (a project with 1 run at 100% counts the same as one with 100 runs at 50%). Each project's own pass rate (`ProjectStatsItem.pass_rate`) is already correctly computed backend-side as `passed / total` across all completed runs of that project, so only the cross-project aggregation is wrong.

On the Reports page the card labelled "Average Pass Rate" actually displays the backend's `overall_pass_rate` (weighted passed/total across all completed runs of the selected project). The value is correct; the label misleads.

Users also want to inspect metrics for a single run without navigating away from the Dashboard — hence the run filter.

Requires a coordinated backend change in **api-testoria plan-040** to expose raw `passed_results` / `total_results` counts on `ProjectStatsItem`, since the existing response only has the derived `pass_rate` per project.

---

## Scope

### In scope
- Fix `DashboardView.vue` overall pass rate to be weighted (sum passed / sum total) across scoped projects
- Consume new `passed_results` / `total_results` fields from bulk stats
- Add a "Select Run" dropdown on the Dashboard that, when a run is picked, scopes metric cards, the doughnut chart, and the recent-runs list to only that run
- Rename Reports page card label "Average Pass Rate" → "Overall Pass Rate"

### Out of scope
- Changing which runs count toward the figure (still completed runs only — matches existing backend semantics)
- Reports page run filter (Reports already has run selection inside the export dialog)
- Pass-rate trend line: stays aggregated across runs; the run filter does not narrow the weekly trend

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/project.ts` | Add `passed_results` / `total_results` to `ProjectStatsItem` |
| views | `src/views/dashboard/DashboardView.vue` | Weighted overall calc; `selectedRunId` ref; `Select` dropdown; run-scoped metrics/charts |
| views | `src/views/reports/ReportDashboardView.vue` | Rename label |

### Key decisions

- **Weighted aggregation source = backend raw counts.** Using `testRunsStore.allRunsFlat` progress numbers is available client-side but would include non-completed runs (inconsistent with how each project's `pass_rate` is computed). Adding raw counts to the bulk-stats response keeps a single source of truth and one round-trip.
- **Run filter is local-only state.** No persistence, no URL sync — scoping resets on reload. Keeps the change small; a project filter is already persisted and that remains the primary navigation axis.
- **Run filter + project filter interact**: selecting a run clears when the project changes; selecting a run narrows within the currently-scoped project. When "all projects" is active and a run is picked, the run's project is implicitly the scope.

---

## Tasks

### Implementation
- [ ] Update `ProjectStatsItem` in `src/types/project.ts` with `passed_results` and `total_results`
- [ ] `DashboardView.vue`: replace equal-weight `overall` calc with weighted sum-passed / sum-total
- [ ] `DashboardView.vue`: add `selectedRunId` ref + PrimeVue `Select` bound to `filteredTestRuns` with clearable placeholder "All runs"
- [ ] `DashboardView.vue`: when a run is selected, derive metric cards (`totalTestRuns=1`, `activeRuns`, `totalTestCases`, pass rate), doughnut, and recent-runs list from that single run
- [ ] `DashboardView.vue`: clear `selectedRunId` on project change
- [ ] `ReportDashboardView.vue`: rename label
- [ ] Update unit tests for any affected composables/utilities

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/06-generated/api-schema.md` — document new fields on bulk stats
- [ ] `docs/01-product/features/011-dashboard.md` and `013-reports.md` (or equivalents) — describe run filter + corrected semantic
- [ ] `docs/08-decisions/changelog.md` — plan entry
- [ ] Plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend deploy lag: frontend reads `passed_results` before API exposes it | Medium | Default to `0` / existing `pass_rate` path when field is missing; deploy API first |
| Run filter confuses users when mixed with project filter | Low | Clear run when project changes; placeholder "All runs" makes state obvious |

---

## Definition of done

- [ ] Overall pass rate on Dashboard equals sum(passed)/sum(total) across scoped projects
- [ ] Reports page label reads "Overall Pass Rate"
- [ ] Select Run dropdown scopes metric card + doughnut + recent-runs to a single run
- [ ] Unit tests + lint + build green
- [ ] Docs + changelog updated
