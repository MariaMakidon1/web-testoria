# Execution Plan: Test Run Lifecycle (planned/active/completed) + Completed-Only Dashboard

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Align the frontend with the API's new 3-status test run lifecycle (`planned → active → completed`) and fix the dashboard so overall pass-rate reflects only completed runs — no more misleading "100%" when a project has a single in-flight run.

---

## Context

A project with one newly created run (status `planned`), two test cases, and a single passed result currently renders **100% overall pass rate** on the dashboard. The metric is derived from the bulk-stats API, which today counts results from every run regardless of status. As soon as one result lands, the project shows a green perfect score even though the run is still open.

The API fix ships in parallel (api-testoria plan 039): analytics endpoints will filter on `TestRun.status == 'completed'`, and the status enum renames `in_progress` to `active` with an auto-transition to `active` on the first result write. This plan adapts the frontend to the new semantics and UX.

Related frontend prior work:
- plan-050 — dashboard headline overall pass-rate as equal-weight average per project; projects with no completed runs excluded
- plan-053 — dashboard wired to `GET /projects/stats` bulk endpoint
- plan-048 — status colour tokens standardised across CSS/TS/PDF/Excel
- plan-052 — report-analytics endpoint
- plan-067 / plan-069 — edit run metadata and edit run cases from detail page
- plan-068 — unify detail and execution views via grouped run-cases endpoint

---

## Scope

### In scope
- Rename `TestRunStatus` value `in_progress` → `active` in `src/types/testRun.ts` (and all references: labels, severity map, filters, conditionals)
- Update every place that shows a run status (detail header, list row, results list, badges, tooltips) so `active` is the canonical in-flight label
- Empty/null state for dashboard stats when a project has no completed runs: show `—` (or "No completed runs yet" where space allows) instead of treating `null` as 0
- Subscribe to the `TestRunStatusChanged` Centrifugo event so detail/execution/list views refresh reactively
- Remove any frontend-side pass-rate averaging that assumed all runs (keep only the equal-weight average over returned per-project values; verify `usePassRateAggregation` composable still matches the new contract)
- Add a "Completed runs" hint / helper text on the dashboard overall pass-rate card explaining what the number covers (one short line)
- Update the test-runs list status filter chips to use `planned`, `active`, `completed`, (`aborted` stays as an advanced filter option)
- Adjust status-gated buttons (`Edit Cases`, `Execute Tests`, `Mark Completed`, `Edit Run`) to read the new status value correctly
- Unit tests for the renamed status in stores, composables, and badge rendering
- At least one E2E test that exercises create run → execute first case → status shows `active` → complete run → dashboard reflects the completed run

### Out of scope
- Backend endpoint or schema changes (delivered by api-testoria plan 039)
- Status-transition timeline UI (e.g. "started at … completed at …" timeline) — nice-to-have, deferred
- Redesign of the dashboard empty state beyond the helper text change
- Changes to the reports view trend chart beyond what the backend's completed-only filter naturally produces
- Introducing a manual "Start Run" button — the API auto-transitions on first result; no UI action required

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testRun.ts` | `TestRunStatus` Literal: `"planned" \| "active" \| "completed" \| "aborted"`; `RUN_STATUS_LABELS` Active label; keep a runtime normaliser that maps incoming `"in_progress"` → `"active"` during API-response parsing for the one-release compat window |
| api | `src/api/testRuns.ts` | In the response adapter (or a small helper), normalise `in_progress` → `active` on read; outgoing calls already use canonical names |
| store | `src/stores/testRuns.ts` | Update any status comparisons (filters, computed flags like `isCompleted`, `isActive`); ensure WS subscription handles `TestRunStatusChanged` and updates the cached run |
| store | `src/stores/testResults.ts` | After a successful result submit, if the current run in the store is still `planned`, optimistically flip it to `active` (backend will confirm via WS event) |
| store | `src/stores/projects.ts` | Re-fetch `bulkStats` after the WS event indicates a run was closed, so the dashboard tiles refresh |
| composables | `src/composables/usePassRateAggregation.ts` | Audit: confirm the filter `status === "completed"` still matches the new value (no rename needed there since `completed` is unchanged); remove any references to `"in_progress"` |
| views | `src/views/dashboard/DashboardView.vue` | Render `null` pass-rate cells as `—` with helper text "No completed runs yet"; add one-line caption under the overall number: "Based on completed runs only" |
| views | `src/views/reports/ReportDashboardView.vue` | Same helper-text line; verify trend chart handles empty/nil data gracefully |
| views | `src/views/test-runs/TestRunDetailView.vue` | Status tag severity: `planned` → `info`, `active` → `warning` (orange — signals "in flight"), `completed` → `success`, `aborted` → `danger`; enable/disable action buttons against the new names |
| views | `src/views/test-runs/TestRunExecutionView.vue` | Optimistic update to `active` when a user submits their first result in a `planned` run; no new button |
| views | `src/views/test-runs/TestRunListView.vue` | Status filter chips, row menu conditions |
| components | `src/components/common/StatusBadge.vue` | Update severity map: add `active`, drop `in_progress` |
| components | `src/components/test-runs/TestResultsList.vue` | Status tag in progress summary uses the new value |
| realtime | `src/composables/useRealtimeRun.ts` (or wherever Centrifugo subscription lives) | Handle `TestRunStatusChanged` payload; update the run in the testRuns store |
| tests | `src/stores/__tests__/testRuns.spec.ts` | Status flags + filter tests against new values |
| tests | `src/components/__tests__/StatusBadge.spec.ts` | Renders correct severity for `active` |
| tests | `src/views/__tests__/DashboardView.spec.ts` | Null pass-rate renders `—` and helper text; overall average ignores null projects |
| tests | `tests/e2e/test-run-lifecycle.spec.ts` (new) | Create → first result → status `Active` → close → status `Completed` → dashboard updates |

### Key decisions

- **`active` gets `warning` (orange) severity** rather than keeping `info` (blue). In PrimeVue, `info` and `completed`-success look similar on the detail header; orange reads as "work in progress, attention may be needed" which matches the semantic.
- **No "Start Run" button.** The backend auto-transitions on first result, so introducing a button would be a no-op concept and an extra click. The UI just reflects the transition when it happens.
- **Empty state uses `—` + caption, not `0%`.** Zero percent implies tested and failed everything; `—` with "No completed runs yet" caption is the honest representation.
- **Runtime normaliser, not a sweeping rename-only.** A small `normaliseRunStatus()` in the API adapter converts `in_progress` from the wire (during the one-release compat window) so the rest of the app only ever sees `active`. This keeps the rename safe across deployment ordering (if web deploys before api, or vice versa).
- **Optimistic `planned → active` update** in the execution view gives instant feedback; the WS event confirms shortly after. If the optimistic update and WS disagree, WS wins (single source of truth).
- **`aborted` stays as a valid status** (even if rarely used) — it's still in the API enum. The UI treats it as a terminal non-completed state: `danger` severity, excluded from stats (same as `active`/`planned`).

---

## Tasks

### Implementation
- [ ] Update `TestRunStatus` type and `RUN_STATUS_LABELS` in `src/types/testRun.ts`
- [ ] Add `normaliseRunStatus()` helper and apply it in API response adapters (`src/api/testRuns.ts`)
- [ ] Update `src/stores/testRuns.ts` status comparisons and WS handler
- [ ] Add optimistic `planned → active` flip in `src/stores/testResults.ts` (or execution view) on first submit
- [ ] Audit `src/composables/usePassRateAggregation.ts` — remove any `in_progress` references
- [ ] Update `StatusBadge.vue` severity map
- [ ] Update `DashboardView.vue`: render `null` pass-rate as `—`, add "Based on completed runs only" caption
- [ ] Update `ReportDashboardView.vue`: same caption; verify chart empty state
- [ ] Update `TestRunDetailView.vue` status tag severity (orange for `active`) and button gating
- [ ] Update `TestRunExecutionView.vue` status display + optimistic update path
- [ ] Update `TestRunListView.vue` status filter chips and row-menu conditions
- [ ] Update `TestResultsList.vue` progress summary status tag
- [ ] Wire `TestRunStatusChanged` Centrifugo event handler and trigger `projectsStore.fetchBulkStats()` when a run transitions to `completed`
- [ ] Write/adjust unit tests for stores, StatusBadge, DashboardView
- [ ] Add E2E spec `test-run-lifecycle.spec.ts`

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — `TestRunStatus` values + note "analytics endpoints consider completed runs only"
- [ ] `docs/06-generated/routes-map.md` — no changes expected; confirm
- [ ] `docs/01-product/features/<feature>.md` — update test-run / dashboard / reports feature docs to describe the 3-status lifecycle and completed-only semantics
- [ ] `docs/00-meta/GLOSSARY.md` — add/update entries for `planned`, `active`, `completed` and note what counts toward stats
- [ ] `docs/02-architecture/frontend/state-management.md` — note WS-driven status updates
- [ ] `docs/08-decisions/changelog.md` — record lifecycle rename + dashboard semantics change
- [ ] `docs/04-execution/tech-debt.md` — add "remove `in_progress` runtime normaliser after one release" as new debt; resolve any existing items on misleading dashboard numbers
- [ ] `docs/05-quality/QUALITY_SCORE.md` — update if E2E coverage changes
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Deploys land out of order (web with `active` before API ships the rename) | Medium | Runtime normaliser in API adapter handles both `in_progress` and `active` on read; outgoing writes never send a status, so there's no write-path mismatch |
| Users on the current dashboard see numbers drop to `—` and think data was lost | Medium | Helper-text caption "Based on completed runs only" plus changelog note; support/Slack heads-up before the release |
| Optimistic `planned → active` flip desyncs from server (e.g. submit fails) | Low | Revert on API error in the catch branch; WS event is the source of truth and will correct any drift within seconds |
| Status filter chips confuse existing users who looked for "In Progress" | Low | Label "Active" is closer to the user's mental model of "currently being executed"; add a tooltip on first render |
| E2E flakiness around WS timing for the status transition | Medium | Use Playwright's `expect(...).toHaveText()` polling on the status tag rather than fixed waits; fall back to a page reload assertion if needed |

---

## Definition of done

- [ ] Creating a run shows status `Planned` in the UI
- [ ] Submitting the first result flips the run to `Active` within one render cycle (optimistic) and stays `Active` after the WS confirmation
- [ ] Clicking "Mark Completed" transitions the run to `Completed` and the dashboard tiles refresh to include the run in pass-rate calculations
- [ ] Dashboard overall pass-rate card shows `—` with "No completed runs yet" when the selected project scope has no completed runs
- [ ] Every place in the UI that showed "In Progress" now shows "Active"; no `in_progress` string remains in the codebase outside the compat normaliser
- [ ] Report analytics view renders without error when the backend returns empty/completed-only data
- [ ] Unit tests cover the new status in stores, StatusBadge, and DashboardView
- [ ] E2E test `test-run-lifecycle.spec.ts` passes end-to-end against a real backend running api-testoria plan-039
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Docs updated (features, glossary, changelog, tech-debt, architecture note)
