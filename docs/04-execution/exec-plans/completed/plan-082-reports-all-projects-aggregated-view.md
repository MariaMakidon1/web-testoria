# Execution Plan: Reports — "All Projects" Aggregated View

**Date**: 2026-05-08
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

When the global project selector is set to "All projects" (i.e. `selectedProjectId === null`), the Reports view (`/reports`) should render aggregated metrics — summary KPIs, distribution donut, automation coverage, pass-rate trend, runs list — across every project the user can see, plus a per-project breakdown table. Today the page renders nothing in that state because every fetch is gated on a single `selectedProjectId`.

---

## Context

`ReportDashboardView` is hard-coded to a single project: every code path early-returns when `selectedProjectId.value` is null (`src/views/reports/ReportDashboardView.vue:80, 90, 361, 383, 414, 475, 547, 560, 567`), and the only fetch is `reportsStore.fetchReportAnalytics(selectedProjectId.value, …)` which calls `GET /projects/:id/report-analytics`. Users in "All projects" mode see the empty placeholder even though every other project-scoped page has either a per-project view or a cross-project alternative.

The home Dashboard already does cross-project aggregation via `projectsStore.fetchBulkStats` (`/projects/stats`, plan-053 / plan-080), but that endpoint only returns per-project rows — it doesn't return the runs list, distributions, or trend the Reports page needs. The backend is adding `GET /reports/analytics` (api plan 043) that returns exactly the same shape as the per-project endpoint, aggregated across all (or a caller-supplied subset of) projects, plus a `per_project[]` breakdown.

Pairs with backend plan `043-be-cross-project-report-analytics.md` in `api-testoria`.

---

## Scope

### In scope

- Project selector in the Reports page header gains an explicit "All projects" option (today the page already reacts to `projectsStore.selectedProjectId === null`, but visually selects nothing — fix that affordance).
- New API function `getCrossProjectReportAnalytics(params)` in `src/api/reports.ts` calling `GET /reports/analytics`.
- New types in `src/types/report.ts`:
  - `RunAnalyticsItem.project_id: number` (additive — backend now always sends it; not breaking)
  - `RunAnalyticsItem.project_name?: string | null` (populated only by the cross-project endpoint)
  - `PerProjectAnalyticsRow` (`project_id`, `project_name`, `total_test_runs`, `completed_runs`, `overall_pass_rate`, `total_results`)
  - `CrossProjectReportAnalytics` (mirrors `ProjectReportAnalytics` minus `project_id`, plus `project_ids: number[] | null` and `per_project: PerProjectAnalyticsRow[]`)
  - `CrossProjectReportAnalyticsParams` (`project_ids?`, `date_from?`, `date_to?`, `run_status?`, `include_trend?`, `include_archived?`)
- `stores/reports` extended with:
  - `crossProjectAnalytics: CrossProjectReportAnalytics | null` (separate slot — analytics shape differs by `per_project[]` and missing `project_id`)
  - `fetchCrossProjectReportAnalytics(params)` action
  - A `clear()`/reset that wipes both slots on selector flip so a stale shape never leaks across modes
- `ReportDashboardView` modified to:
  - Drive a `mode = computed<'project' | 'all'>(() => selectedProjectId.value ? 'project' : 'all')` switch
  - In `'all'` mode: call `fetchCrossProjectReportAnalytics`, derive every chart input from `crossProjectAnalytics` instead of `analytics`, render the same KPI cards / distribution donut / automation donut / pass-rate trend / runs list with `project_name` shown alongside each run row
  - Render an additional **Per-project breakdown** panel (one row per project: name, completed runs, overall pass rate, total results) — clicking a row sets `projectsStore.selectedProjectId` and the page transitions back to per-project mode
  - Keep the existing per-project mode unchanged (passes a snapshot test on the existing payload pipeline)
- `Select Run` filter: keep it functional in 'all' mode by sourcing options from `crossProjectAnalytics.runs` (each option label becomes `<project_name> · <run_name>` for disambiguation). When a run is picked, the KPIs collapse to that run's own pass rate exactly like in per-project mode.
- Date range and run status filters: behave identically in both modes — pass through to the cross-project endpoint.
- Export dialog behaviour: the existing client-side Excel/PDF export (`useExcelExport`, `usePdfExport`) is per-project — it lazy-loads `testCasesStore.fetchTestCases(projectId)` and a per-run results blob. In 'all' mode, **disable the export button** with a tooltip ("Select a single project to export"). Multi-project export is out of scope for this plan.
- Routing: `/reports` already has `requiresAuth: true`; no change.
- Unit tests for the new store action and the cross-project derivations on the view.
- E2E test: navigate to `/reports`, switch to "All projects", verify KPI cards + per-project breakdown render with seeded multi-project data.

### Out of scope

- Multi-project Excel/PDF export — deferred. Add to tech debt with the disabled-button rationale.
- Per-project trend overlay (separate coloured lines per project on one chart) — backend ships a single aggregated trend; overlay is a follow-up.
- Persisting "All projects" as a URL query param — `?project=all` is desirable but the project selector's state persistence is broader than this plan; keep selector behaviour as-is and let the global selector state propagate.
- Replacing the existing `getProjectReportAnalytics` flow with `?project_ids=N` against the new endpoint — unifying paths is a refactor, not this plan; keep both endpoints and pick one based on `mode`.
- Backend project-level visibility/ACL — assumes the backend continues to return every project the caller is allowed to see (today: every project).

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/report.ts` | Add `project_id`/`project_name` to `RunAnalyticsItem`; add `PerProjectAnalyticsRow`, `CrossProjectReportAnalytics`, `CrossProjectReportAnalyticsParams` |
| api | `src/api/reports.ts` | Add `getCrossProjectReportAnalytics(params)` calling `GET /reports/analytics` (axios `params` serializer must repeat `project_ids` as `?project_ids=1&project_ids=2` — verify against existing `/projects/stats` call which already does this for `project_ids`) |
| store | `src/stores/reports.ts` | Add `crossProjectAnalytics` ref, `fetchCrossProjectReportAnalytics` action, `reset()`/`clear()` to wipe both slots on selector flip; expose both slots from the store |
| views | `src/views/reports/ReportDashboardView.vue` | Drop the `if (!selectedProjectId.value) return` guards; add a `mode` computed; branch every fetch and every chart-input computed on `mode`; render `PerProjectBreakdown` panel in 'all' mode; disable export button with tooltip in 'all' mode; thread `project_name` into the runs list row template |
| components | `src/components/reports/PerProjectBreakdown.vue` (new) | Read-only table: `project_name`, `total_test_runs`, `completed_runs`, `overall_pass_rate` (rendered green via `.pass-rate-value` like the dashboard), `total_results`. Row click emits `select` with the `project_id`; the view sets `projectsStore.selectedProjectId` |
| components | `src/components/reports/RunsListItem.vue` (or wherever the run rows live in `ReportDashboardView`) | When `project_name` is present on the row, render it as a small subtitle/badge above the run name |
| docs | `docs/06-generated/api-schema.md` | Add `getCrossProjectReportAnalytics`; note `project_id`/`project_name` additions on `RunAnalyticsItem` |
| docs | `docs/01-product/features/010-reports-dashboard.md` | Add the "All projects" mode section, the per-project breakdown panel, the disabled-export caveat |

### Key decisions

- **Two store slots, not one.** `analytics` (per-project) and `crossProjectAnalytics` (all-projects) live alongside each other — different shapes, and we want stale per-project data to remain available for instant rehydration when the user flips back. `reset()` wipes both on logout; selector flips wipe only the inactive slot.
- **`mode` computed, not a feature flag.** The mode is purely derived from `projectsStore.selectedProjectId`; no setter on the view. This keeps the global project selector as the single source of truth (no drift).
- **Run options labelled with project name in 'all' mode.** Without it, two runs named "Sprint 23" from different projects are indistinguishable in the dropdown. The label format `<project_name> · <run_name>` matches existing UX in the home Dashboard's recent-runs list (plan-074).
- **Export disabled in 'all' mode, not silently broken.** `useExcelExport` and `usePdfExport` are written around a single project's test cases + a single run's results — calling them with cross-project data would silently produce a wrong export. Disable the button with a tooltip; multi-project export is a separate plan.
- **Backend already handles the aggregation rules** (api plan 043, plan 041, plan 080 conventions). The frontend renders what it gets — no client-side cross-project averaging. This means the Reports KPI in 'all' mode will agree with the home Dashboard's overall pass-rate tile by construction.
- **Per-project breakdown is clickable, not just informational.** The most common follow-up after spotting an underperforming project in the breakdown is "drill into it". One click sets the selector and the page re-renders in per-project mode.

---

## Tasks

### Implementation
- [ ] Add `project_id`/`project_name` to `RunAnalyticsItem` and the new types in `src/types/report.ts`
- [ ] Add `getCrossProjectReportAnalytics` in `src/api/reports.ts` (verify axios `params` repeats `project_ids[]` correctly — match the call style used by `getProjectStatsBulk`)
- [ ] Extend `stores/reports`: add `crossProjectAnalytics`, `fetchCrossProjectReportAnalytics`, `reset()` (or extend the existing reset)
- [ ] Build `src/components/reports/PerProjectBreakdown.vue` with row-click → `projectsStore.selectedProjectId = id`
- [ ] Refactor `ReportDashboardView.vue`:
  - [ ] Add `mode` computed
  - [ ] Replace early-return guards with mode branches
  - [ ] Wire `mode === 'all'` fetch to `fetchCrossProjectReportAnalytics`
  - [ ] Branch every chart-input computed on `mode` to read from the right slot
  - [ ] Add the `PerProjectBreakdown` panel in 'all' mode
  - [ ] Update Select Run dropdown options to use `<project_name> · <run_name>` in 'all' mode
  - [ ] Disable export button with tooltip in 'all' mode
  - [ ] Update the page header — render "All projects" when `selectedProjectId === null`
- [ ] Update the runs list row component to render `project_name` when present
- [ ] Add `watch(selectedProjectId)` to clear the inactive store slot and refetch the active one
- [ ] Wire `clear()` on logout (extend existing logout reset chain)
- [ ] Write unit tests for the store action and the new view derivations (mode flip, run dropdown labelling, KPI from `crossProjectAnalytics`)
- [ ] Write/extend an e2e test in `tests/e2e/reports.spec.ts` covering: load `/reports` with multi-project seed data, switch to "All projects", assert KPI + per-project breakdown render, click a row → selector flips, page re-renders in per-project mode

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (vue-tsc strict)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — add `getCrossProjectReportAnalytics`, note `project_id`/`project_name` additions to `RunAnalyticsItem`
- [ ] `docs/01-product/features/010-reports-dashboard.md` — add the "All projects" mode section: data fetch, per-project breakdown, run-dropdown labelling, disabled-export caveat
- [ ] `docs/02-architecture/ARCHITECTURE.md` — update the `Reports dashboard aggregated analytics` row in the "Where is X?" table if the store gains a second slot (likely yes); note `PerProjectBreakdown` component
- [ ] `docs/08-decisions/changelog.md` — plan-082 entry: All-projects mode added to Reports view, paired with api plan 043, mean-of-run-rates rule unchanged
- [ ] `docs/04-execution/tech-debt.md` — add: "Multi-project Excel/PDF export" with the rationale and the fix sketch (extend `useExcelExport`/`usePdfExport` to accept multi-project payload, or generate one file per project bundled in a zip)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Cross-project payload is large with many projects/runs and slows initial render | Medium | Backend default-windows and per-row payload is small; if visible on local, paginate the runs list client-side — backend response stays full so KPIs/distribution/trend still render correctly |
| Stale analytics flash when flipping selector before fetch resolves | Medium | Wipe the inactive slot synchronously in the watcher before `await` on the new fetch; render skeletons while loading |
| Run-dropdown options balloon with many projects | Medium | Already capped naturally by date range; if dropdown becomes unusable, swap to a `Listbox` with virtual scroll. Out of scope unless a customer hits it |
| Export button disabled is non-obvious | Low | Tooltip explicitly says "Select a single project to export"; visible affordance — same UX pattern as other capability-gated buttons |
| Existing per-project export silently breaks because `RunAnalyticsItem` schema added fields | Low | Fields are additive, optional on the per-project endpoint side; existing TS types updated in lockstep — `vue-tsc` catches any consumer that needed the old shape |
| Per-project breakdown click resets too much state (e.g. clears the date range) | Low | Only set `selectedProjectId` in the click handler; leave the rest of the local view state alone |

---

## Definition of done

- [ ] `/reports` renders KPIs, distribution, automation coverage, trend, runs list, and per-project breakdown when `selectedProjectId === null`, against the real backend
- [ ] Per-project breakdown row click flips the selector and the page rehydrates in per-project mode without a full reload
- [ ] Run dropdown options in 'all' mode are unambiguous (project name prefix) and selecting one collapses the KPI cards to that run's own pass rate
- [ ] Date range and run status filters work identically in both modes
- [ ] Export button disabled with tooltip in 'all' mode; remains enabled in per-project mode
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [ ] E2E test for the All-projects flow passes
- [ ] PR checklist completed
- [ ] Docs updated
