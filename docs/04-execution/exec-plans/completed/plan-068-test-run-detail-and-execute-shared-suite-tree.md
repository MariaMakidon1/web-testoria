# Execution Plan: Shared suite-tree results view on `/test-runs/:id` and `/test-runs/:id/execute`

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Render the test-run detail page (`/test-runs/:id`) and the test-run execution page (`/test-runs/:id/execute`) from a single shared "suite tree with results" component, backed by the same source (`GET /test-runs/{id}/cases?group_by=suite`). Users see the same grouping, counts, and row shape on both pages — only the interaction layer differs (read vs execute).

---

## Context

Today the two pages diverge in two unnecessary ways:

1. **Data source**.
   - `TestRunDetailView.vue` calls `testResultsStore.fetchResults(runId)` — a flat list of executed results only (`TestRunDetailView.vue:59`). Web plan 055 already migrates this to `GET /test-runs/{id}/cases` (flat).
   - `TestRunExecutionView.vue` calls `testCasesStore.fetchTestCases(projectId)` — every case in the **project**, not the run — then filters and groups client-side by `suite_id` via the flat suites store (`TestRunExecutionView.vue:90-126, 530-536`). This pulls cases that aren't part of the run and depends on a separate suites fetch.

2. **Grouping**. The detail page has no suite grouping at all — it's a flat list of rows. The execution page groups by *flat* `suite_id`, not the suite hierarchy. Neither matches how testers think about a run ("I want to walk the Smoke suite, then the Regression suite").

Api plan 034 exposes `GET /test-runs/{id}/cases?group_by=suite` returning `TestRunSuiteTree`: nested suites with per-suite progress counters, each holding its own cases + optional results. This plan consumes it and unifies both pages around one `<SuiteTreeResults>` component.

Assumes merged/in-flight:
- Plan 054 / api plan 032 — `no_run` literal exists
- Plan 055 — detail page already on `GET /test-runs/{id}/cases` (flat); this plan swaps it to the grouped projection
- Api plan 034 — the grouped endpoint

---

## Scope

### In scope

- New shared component `src/components/test-runs/SuiteTreeResults.vue` that renders a collapsible suite tree of cases with their status/result
  - Emits `select(row)` so parents control what happens on row click
  - Emits `open-case(caseId)` for "go to execute this case"
  - Accepts an `interactionMode: "read" | "execute"` prop that toggles the row-level affordances (no status-edit controls in read mode; step-status picker + pass/fail/block buttons in execute mode)
  - Renders per-suite progress (mini stacked bar + counts) on each branch header
  - Collapsible branches with state persisted in `localStorage` keyed by `runId`
- New store action `testRunsStore.fetchSuiteTree(runId)` that calls `GET /test-runs/{runId}/cases?group_by=suite` and exposes `suiteTree.value` (plus `roots`, `totalByRun`)
- `TestRunDetailView.vue` uses `<SuiteTreeResults :mode="'read'">`; clicking a row opens the existing `TestResultDetail` panel (history/comments/attachments when `result.id != null`, "not yet run" panel when null — behaviour introduced by plan 055 is preserved)
- `TestRunExecutionView.vue` uses `<SuiteTreeResults :mode="'execute'">`; selecting a row loads the execution panel for that case; the "auto-advance to next untested" helper walks the tree in render order instead of the flat list
- Both pages read progress counts from `runProgress` (authoritative) for the overall bar; the per-suite mini bars come from the tree response
- Filters (status, search) operate over the tree — branches with zero matching cases collapse to hidden, not just visually empty
- Unit tests for the shared component (tree render, collapse, filter, status/mode behaviour)
- Unit tests for the new store action
- E2E: open a run with nested suites on both pages; verify tree renders identically; verify execute actions on the execute page; verify history/detail on the detail page

### Out of scope

- Redesign of `TestResultDetail` / `TestResultHistoryPanel` — reuse as-is
- Changing `TestRunProgressBar` — it stays bound to `runProgress`
- Drag-and-drop / suite reordering in the tree
- Server-side filtering — filters stay client-side within the already-capped response
- Export (PDF/Excel) changes — those still flow through the executed-results path
- Pagination UI — inherits whatever cap api plan 033/034 lands on
- Bulk actions (mark all in suite as passed, etc.) — logged as tech debt

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testRun.ts` (or new `suiteTree.ts`) | `TestRunSuiteNode`, `TestRunSuiteTree` mirroring the API response; reuse existing `TestCaseWithResult` if already present from plan 055, otherwise add |
| api | `src/api/testRuns.ts` | `getRunSuiteTree(runId): Promise<TestRunSuiteTree>` calling `GET /test-runs/{id}/cases?group_by=suite` |
| store | `src/stores/testRuns.ts` | `suiteTree: Ref<TestRunSuiteTree \| null>`; `fetchSuiteTree(runId)` action; clear on `setCurrent` change |
| components | `src/components/test-runs/SuiteTreeResults.vue` | **New**. Renders nested branches; row component delegated to a small internal `SuiteTreeRow`; emits `select`, `open-case`; mode-driven affordances |
| components | `src/components/test-runs/SuiteTreeRow.vue` | **New, small**. Renders a single case with status badge, title, id, priority; in execute mode, exposes pass/fail/block quick actions |
| views | `src/views/test-runs/TestRunDetailView.vue` | Replace `<TestResultsList>` with `<SuiteTreeResults mode="read">`; route `@select` into the existing detail-panel state; remove the flat-list filter bar or reposition it above the tree |
| views | `src/views/test-runs/TestRunExecutionView.vue` | Remove `testCasesStore.fetchTestCases(projectId)`; replace the local `testCases`/`filteredTestCases`/`getSuiteName` logic with `<SuiteTreeResults mode="execute">`; keep the right-hand execution panel; update the "next untested" helper to walk the tree (DFS) |
| store cleanup | `src/stores/testResults.ts` | `fetchResults(runId)` remains for exports/history; remove from the two views' mount hooks in favour of `fetchSuiteTree` (plus `fetchProgress`) |
| tests | `tests/unit/components/SuiteTreeResults.spec.ts` | Tree render, collapse, status filter, per-suite progress counts, row emits |
| tests | `tests/unit/stores/testRuns.spec.ts` | `fetchSuiteTree` populates state; clears on run change |
| e2e | `tests/e2e/test-run-detail.spec.ts`, `tests/e2e/test-run-execute.spec.ts` | Same tree on both pages; filter by `no_run` hides zero-match branches; execute page's pass/fail writes through and auto-advances |

### Key decisions

- **One component, two modes — not two components**. `mode="read"` vs `mode="execute"` keeps the tree, counts, filters, and collapse state identical across pages, and centralises the "walk DFS for auto-advance" helper. The views stay thin and the divergence is purely in row affordances + parent-side handlers.
- **Tree response is the render model**. Don't re-group on the client. The store exposes `suiteTree.value` directly; the component reads `tree.roots` and renders recursively. Progress counts come pre-computed per node from the API (plan 034).
- **Runtime truth vs rendered counts**: the detail page's overall progress bar stays on `runProgress` (authoritative). Per-suite mini bars come from the tree. After an execute action on the execute page, both are refreshed (`fetchProgress` + `fetchSuiteTree`); optimistic in-place update of a single node can come later.
- **Synthesise `no_run` client-side** (consistent with plan 055): rows whose `case.result` is null get a synthetic shape with `id: null`, `status: "no_run"`. Nothing sends `id: null` back to the server.
- **Filter state is per-view, collapse state is per-run**. Testers close a suite they've already walked; that state should survive a page switch between `/detail` and `/execute` for the same run, so persist collapse under `testoria.suiteTree.collapsed[runId]` in `localStorage`. Status/search filters reset per view.
- **Delete the duplicated `getSuiteName` lookup on the execution view**. The tree response already carries `suite.name`; the ad-hoc flat lookup (`TestRunExecutionView.vue:124-126`) goes away.
- **Do not share state via the existing `testResults` store**. It's the executed-only source (used by exports, history). Keep it for those; route tree state through `testRuns` store.
- **Execute mode's "next untested"**: walk `tree.roots` DFS, yield cases in render order, pick the first whose status is `no_run`. This is stable across reloads (unlike the old flat sort by case id).

---

## Tasks

### Implementation
- [ ] Confirm api plan 034 is available; if not, coordinate timelines — this plan is blocked without the grouped endpoint
- [ ] Confirm plan 055 merged; the `result: null → no_run` synthesis helper already exists and is reused here
- [ ] Add `TestRunSuiteNode`, `TestRunSuiteTree` types (`src/types/testRun.ts` or a dedicated file)
- [ ] Add `getRunSuiteTree(runId)` in `src/api/testRuns.ts`
- [ ] Add `suiteTree`, `fetchSuiteTree(runId)` to `src/stores/testRuns.ts`; clear on run change; unit-test the action
- [ ] Build `<SuiteTreeResults>`:
  - [ ] Props: `tree: TestRunSuiteTree`, `mode: "read" | "execute"`, `filter: { status?; search? }`, `selectedCaseId?`
  - [ ] Emits: `select(row)`, `open-case(caseId)`, optional `execute(caseId, verdict)` in execute mode
  - [ ] Recursive render of `roots → children`
  - [ ] Collapse toggle per suite; persist to `localStorage`
  - [ ] Per-suite header shows name + mini progress bar + counts
  - [ ] Synthesise `no_run` rows when `case.result` is null (reuse helper from plan 055)
- [ ] Build `<SuiteTreeRow>`:
  - [ ] Read mode: status badge, title, id, priority, automation_id, click → `select`
  - [ ] Execute mode: adds quick-action buttons (pass/fail/block) that emit `execute`
- [ ] Switch `TestRunDetailView.vue`:
  - [ ] Mount hook: `fetchSuiteTree(runId)` + `fetchProgress(runId)` (drop `fetchResults`)
  - [ ] Replace `<TestResultsList>` with `<SuiteTreeResults mode="read">`
  - [ ] `@select` wires the existing `TestResultDetail` panel
  - [ ] Existing "not yet run" panel (from plan 055) still shown for synthetic rows
- [ ] Switch `TestRunExecutionView.vue`:
  - [ ] Drop `testCasesStore.fetchTestCases(projectId)`; drop `getSuiteName`
  - [ ] Mount hook: `fetchSuiteTree(runId)` + `fetchProgress(runId)` (still load the case detail when a row is selected, via existing store)
  - [ ] Replace the flat case list with `<SuiteTreeResults mode="execute">`
  - [ ] Rewrite the "first untested" helper as a DFS over the tree
  - [ ] On successful execute, refresh `fetchSuiteTree` + `fetchProgress` (optimistic update tracked as follow-up)
- [ ] Filter bar above the tree: status dropdown (incl. `no_run`), search text; applied in-component; branches with zero matches hidden
- [ ] Unit tests:
  - [ ] Renders nested tree; counts match node.progress
  - [ ] `result: null` synthesised into a `no_run` row
  - [ ] Filtering by `no_run` hides suites with zero matches
  - [ ] Collapse state persists across mount
  - [ ] Execute mode emits the right event; read mode does not render the action buttons
- [ ] E2E:
  - [ ] Seed a run with nested suites and a mix of executed / not-executed cases
  - [ ] `/test-runs/:id`: tree renders; per-suite counts sum to total; click a `no_run` row → "not yet run" panel; click an executed row → history/detail panel
  - [ ] `/test-runs/:id/execute`: same tree; pick a row → execution panel populated; pass a case → progress bar + per-suite counts refresh; "next untested" jumps in tree order
  - [ ] Reload mid-walk: collapse state preserved
- [ ] Manual: dark-mode rendering of tree lines, per-suite progress, collapsed chevron
- [ ] Manual: keyboard navigation (arrow up/down to move between rows, left/right to collapse/expand)

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build` (vue-tsc)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/routes-map.md` — no route change; verify
- [ ] `docs/06-generated/api-schema.md` — add `GET /test-runs/{id}/cases?group_by=suite` response type
- [ ] `docs/01-product/features/006-test-execution.md` — describe the shared suite-tree view on both pages
- [ ] `docs/02-architecture/frontend/components.md` — document `<SuiteTreeResults>` as a shared primitive
- [ ] `docs/02-architecture/frontend/state-management.md` — note `testRunsStore.suiteTree` as the source for the grouped view; `testResults` stays for executed-only flows
- [ ] `docs/08-decisions/changelog.md` — record: unified both pages on one component + one endpoint; mode prop over component duplication; rejected server-side filtering
- [ ] `docs/04-execution/tech-debt.md` — add: (a) optimistic in-place update of a single case node on execute, (b) bulk actions (pass/fail/block whole suite), (c) virtual scrolling if runs grow beyond a few thousand cases
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Two consumers of one component drift (read-mode grows execute-mode code or vice versa) | Medium | Mode handling lives in the row component behind a single prop; unit tests assert that read mode renders no action buttons |
| Execution page regresses auto-advance order when switching from flat sort to DFS | Medium | E2E test walks the tree and asserts the picked case matches first `no_run` in render order; visual cue on the tree shows the next target |
| Collapse state in `localStorage` grows unbounded across runs | Low | Scope key by `runId`; add a trim on load (keep last 50 run IDs) |
| Per-suite mini progress bar drifts from `runProgress` after an execute action | Medium | Refresh both after a write; follow-up plan can add optimistic update if latency hurts |
| Large nested trees render slowly in the browser | Low | Current cap is plan 033's 2000 cases across the whole run — nesting overhead is small; virtual scrolling logged as tech debt |
| Existing `TestResultsList` unit tests reference a component this plan retires on the detail page | Low | Move/rename the relevant tests to cover `<SuiteTreeResults>`; delete or adapt obsolete cases |
| `testCasesStore.fetchTestCases(projectId)` was pulling data other code paths depend on | Low | Grep the execution view's template and handlers; the only usages are the list + `getSuiteName`, both retired |
| A suite visible in read mode but filtered out in execute mode causes confusion | Low | Both pages use the same tree endpoint; filters are view-local — documented, and the page title band shows the active filter |

---

## Definition of done

- [ ] `/test-runs/:id` and `/test-runs/:id/execute` render the same tree from `GET /test-runs/{id}/cases?group_by=suite`
- [ ] Detail page: clicking a row opens the existing detail/history panel (or "not yet run" panel for synthetic rows)
- [ ] Execute page: clicking a row opens the execution panel; pass/fail/block actions work; progress refreshes
- [ ] "Next untested" on the execute page walks the tree in DFS render order
- [ ] Per-suite mini progress bars match per-node `progress` counts; overall bar stays on `runProgress`
- [ ] Filters (status, search) collapse zero-match branches
- [ ] Collapse state persists per run across reloads and across the two pages
- [ ] `testCasesStore.fetchTestCases(projectId)` no longer called from `TestRunExecutionView`
- [ ] Synthetic rows (`id: null`, `status: "no_run"`) never produce submit/update/history calls
- [ ] Unit + e2e tests pass
- [ ] Docs updated
- [ ] PR checklist completed
