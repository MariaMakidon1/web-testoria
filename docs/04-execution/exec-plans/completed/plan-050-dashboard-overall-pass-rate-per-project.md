# Execution Plan: Dashboard Overall Pass Rate — Per-Project Average + Green Color

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On the dashboard (home) page, change the "Overall Pass Rate" card so the headline number is an **average of per-project averages** (each project weighted equally rather than runs-dominating), show a small per-project breakdown inside/under the card, and always render the headline value in green — dropping the threshold-based red/amber/green color logic.

---

## Context

Today the card at `src/views/dashboard/DashboardView.vue:400–408` renders `metrics.overallPassRate` with a threshold color via `getPassRateColor` (`DashboardView.vue:248–252`: ≥90 green, ≥70 amber, else red). The underlying computation lives at `DashboardView.vue:59–79`:

```ts
const completedRuns = testRuns.filter((tr) => tr.status === "completed" && tr.progress);
const avgPassRate = completedRuns.reduce((sum, tr) => sum + (tr.progress?.pass_rate || 0), 0) / completedRuns.length;
// metrics.overallPassRate = round(avgPassRate, 1)
```

Two problems:
1. **Run-weighted average hides smaller projects**: a project with 50 completed runs at 95% drowns out a project with 3 runs at 40%. The product signal the dashboard is supposed to convey — "how are my projects doing overall?" — becomes "how is my biggest project doing?".
2. **Color is threshold-based** and punishes the user visually for ongoing early-stage work. The user's ask is to make the card read as a positive summary indicator, always in green, with the number itself carrying the information.

No backend work is required. `GET /projects/{id}/stats` (`api-testoria/app/api/v1/projects.py:89`) already exists and returns `pass_rate`, and the dashboard already holds all runs in memory via `filteredTestRuns`, so the per-project averaging can run client-side. The existing endpoint is noted as a later optimization (single bulk call), not a blocker.

---

## Scope

### In scope
- Replace the run-weighted `overallPassRate` computation with an **average of per-project averages** over completed runs with `progress`
- Add a per-project breakdown: a compact list inside the Overall Pass Rate card (project name + per-project pass rate + a tiny bar), capped at ~5 rows with a "more" link to the full report view if there are more projects
- Always render the headline number in green (reuse `var(--status-passed)`, the same token used by the segmented progress bar in plan 104) — remove the threshold-based `getPassRateColor` function entirely
- Exclude archived projects from the breakdown (match `filter((p) => !p.is_archived)` already used in the metrics block at line 55)
- Exclude projects with zero completed runs from the numerator *and* denominator of the average-of-averages (so "no data" projects don't pull the number down to 0% or get listed as `0%` in the breakdown); instead render them as `—` in the breakdown with a tooltip "no completed runs yet"
- Respect the existing `selectedProjectId` filter: when a single project is selected, the card shows that project's average pass rate (single row) and no breakdown list
- Unit test the aggregation function as pure logic

### Out of scope
- A new `GET /projects/stats` bulk endpoint (optional optimization — logged as tech debt / follow-up)
- Changing the threshold colors on `ProjectDetailView.vue` or `ReportDashboardView.vue`
- Adding a trend sparkline per project inside the breakdown
- Recomputing pass rate definition (`passed / tested`, not `passed / total`) — keep whatever `run.progress.pass_rate` already contains (backend-authoritative, matches plan 104)
- Any card other than "Overall Pass Rate"

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| composables | `src/composables/usePassRateAggregation.ts` (new) | Pure function `aggregatePassRatesByProject(runs, projects): { overall: number; perProject: Array<{ projectId, name, passRate \| null, runCount }> }` — groups by `project_id`, averages each project's completed runs, averages the projects that have ≥1 completed run |
| views | `src/views/dashboard/DashboardView.vue` | Replace lines 59–79 aggregation with a call to the composable; add a per-project breakdown block inside the Overall Pass Rate card template (lines ~400–408); remove `getPassRateColor` function (lines 248–252); always use `color: var(--status-passed)` for the headline; pass `selectedProjectId` through so the card can collapse to a single-project view |
| types | `src/types/report.ts` or similar | `PerProjectPassRate { projectId: number; name: string; passRate: number \| null; runCount: number }` |

### Key decisions

- **Average of averages, not weighted**: each project contributes equally regardless of run count. This matches the user's intent ("per project") and protects smaller projects from being drowned by dominant ones. Note this in the changelog because it changes the semantic meaning of the headline number compared to what users may have memorized.
- **Projects with zero completed runs are excluded from the average**: including them as `0%` would penalize any newly started project and push the headline toward 0%. Excluding them keeps the number meaningful. In the breakdown list, surface them as `—` so the user knows they exist but understands why they do not contribute.
- **Always green, not threshold-based**: remove `getPassRateColor` entirely, do not keep it dormant. The color stays green (`var(--status-passed)`) to communicate "this is a positive overview metric"; the number itself carries the performance signal. If a user wants red/amber/green later, that is a separate (reversible) decision — do not build it back in conditionally.
- **Reuse the status token, not a hardcoded hex**: `var(--status-passed)` is already the source of truth for the "passed" green (pending plan 106 if it ships first — either way, the token exists today). Avoids drift and matches plan 104's segmented progress bar.
- **Breakdown inside the card, not a new card**: keeps the dashboard layout stable and makes the card self-contained. Cap at ~5 rows to avoid pushing other dashboard cards off the fold; if `>5`, show a "view all in Reports →" link to `ReportDashboardView`.
- **Single-project selection collapses the breakdown**: when the user has picked a specific project via `selectedProjectId`, the breakdown list is redundant. Show only the single project's row (or just the headline).
- **Pure composable extracted**: the aggregation is the part most likely to have bugs (zero-run projects, archived projects, single-project mode) and is trivially unit-testable outside Vue. Keeping it in a composable (or a plain `.ts` helper) is cleaner than inline `computed` spaghetti in a 1000+ line view.
- **No API plan**: the per-project data is already in memory via `filteredTestRuns` + `projects`. Firing N `GET /projects/{id}/stats` calls would be wasteful, and a bulk endpoint (`GET /projects/stats`) is a nice-to-have logged as a follow-up rather than a prerequisite.

---

## Tasks

### Implementation
- [x] Create `src/composables/usePassRateAggregation.ts` exporting a pure `aggregatePassRatesByProject(runs, projects, options?)` function
  - Group runs by `project_id`, keep only `status === 'completed' && progress`
  - Per project: `sum(run.progress.pass_rate) / runCount` → project average (`null` when `runCount === 0`)
  - Overall: `sum(projectAverages where non-null) / count(projects where non-null)`, `null` when no project has data
  - Accept `options.excludeArchived` (default true) and `options.selectedProjectId`
  - Return `{ overall, perProject }` sorted by project name for stable rendering
- [x] Unit test the composable:
  - No runs at all → `overall === null`
  - One project with 5 completed runs → overall equals its average
  - Two projects, one with many runs at 95%, one with one run at 40% → overall is ~67.5 (average of averages, not run-weighted)
  - Projects with zero completed runs excluded from denominator
  - Archived projects excluded
  - `selectedProjectId` set → returns only that project's row and an `overall` equal to its average
- [x] Update `src/views/dashboard/DashboardView.vue`:
  - Replace the `overallPassRate` computation in `metrics` (lines ~59–79) with a call to the composable
  - Delete `getPassRateColor` (lines 248–252) and its only call site (line 403)
  - Add `style="color: var(--status-passed)"` to the metric value; verify dark mode
  - Add a per-project breakdown template inside the Overall Pass Rate card: a small `<ul>` or a compact PrimeVue `DataView`/`DataTable` with columns `project name` | `pass rate` | tiny bar; capped at 5 rows
  - Add a "View all in reports" link if there are more than 5 projects, navigating to `ReportDashboardView`
  - When `selectedProjectId` is set, render a single row (or just the headline) instead of the list
  - Render `null` overall as `—` (not `0%`) with a subtitle "no completed runs yet"
  - Render `null` per-project entries as `—` with the same tooltip
- [x] Grep the dashboard file for `overallPassRate` and confirm every reference uses the new value
- [x] Visual check in both light and dark mode: the green headline remains legible, the breakdown list does not overflow the card, and the fallback `—` state renders correctly when the dashboard has no completed runs

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (including the new composable tests)
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke against a seeded dev DB with (a) multiple active projects with mixed pass rates, (b) a single-project filter, (c) an empty state with zero completed runs

### Docs update (Phase 5)
- [x] `docs/01-product/features/reports-dashboard.md` (or the dashboard feature doc) — document the new "average of per-project averages" semantics and the per-project breakdown block, and note the always-green color decision
- [x] `docs/02-architecture/ARCHITECTURE.md` — add `usePassRateAggregation` to the codemap and the "Where is X?" table
- [x] `docs/03-engineering/patterns/composables.md` — mention the pure-aggregation composable pattern (shared with `useOverallStatusSuggestion` from plan 105)
- [x] `docs/08-decisions/changelog.md` — record: headline now equal-weight per project, always green, threshold coloring removed, zero-run projects excluded from the average
- [x] `docs/04-execution/tech-debt.md` — log "add `GET /projects/stats` bulk endpoint to avoid N+1 stat fetches from the dashboard if data volume grows" as a follow-up
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map / api-schema update — no routes, no new API calls.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Users memorized the old run-weighted number and interpret the new value as a regression | Medium | Changelog note + a tooltip on the headline: "average of per-project averages — each project weighted equally" |
| Breakdown list makes the card taller than the siblings and breaks the dashboard grid | Medium | Cap at 5 rows; the rest collapses behind a link; manual check on narrow viewports |
| Removing `getPassRateColor` leaves dead imports or unused CSS classes | Low | TS + build will catch direct references; grep for `text-success`, `text-danger`, etc. |
| Empty-state (no projects have completed runs) renders `NaN%` or `0%` | Medium | Composable returns `null` for that case; template renders `—` with an explanatory subtitle |
| A project with a single run at 100% dominates the headline visually in the breakdown | Low | Show run count next to each row so the user can judge confidence |
| Dark-mode green token contrast drops below AA against the card background | Low | Verify during the sweep; if it drops, use a slightly brighter variant via a dark-mode override |

---

## Definition of done

- [x] Headline "Overall Pass Rate" is the average of per-project pass-rate averages (each project weighted equally)
- [x] Headline always renders in green using `var(--status-passed)`; the `getPassRateColor` function is gone
- [x] A per-project breakdown list renders inside the card (capped at 5 rows; "view all" link for the rest)
- [x] Projects with no completed runs render as `—` in the breakdown and do not contribute to the overall average
- [x] When `selectedProjectId` is set, the card collapses to a single-project view
- [x] The composable is unit-tested for the documented edge cases
- [x] Build passes; no dead references to the removed threshold function
- [x] PR checklist completed
- [x] Docs updated
