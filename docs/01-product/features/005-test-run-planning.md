# Feature: Test Run Planning

## What it does

Test Run Planning is the process of creating a TestRun — a named, scoped execution event that gathers a set of test cases to be run against a specific build or environment. During planning, the user selects which test suite (or individual cases) to include, configures the environment (key-value pairs for browser, OS, build number, etc.), assigns a tester, and optionally links a milestone.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Create and configure test runs in any project |
| **Lead** | Create and configure test runs in their projects |
| **Tester** | Create, delete, and execute test runs (`canManageTests`) |
| **Read Only** | Read-only access to test run list and detail |

## Key behaviours

- Entry point: `TestRunCreateView` at `/test-runs/create`. Callers may pass `?projectId=<id>` to seed and lock the project Select (gate at `:disabled="!!route.query.projectId"`); `ProjectDetailView`'s **New Test Run** button uses this contract (plan-086, fixes TES-80).
- **Cancel button on every wizard step** (plan-089, fixes TES-72). Each `.step-actions` row has a left-most `Cancel` button (`text severity="secondary"`, `data-testid="create-cancel-btn"`) that calls `router.push(backTarget.to)` — the same exit destination as the page-header back button (plan-086). One source of truth: with `?projectId=<id>` → `/projects/:id`, otherwise → `/test-runs`. No confirmation modal — matches every other Cancel in the app (`EditTestRunDialog`, project create/edit).
- **Wizard step badges are 1-indexed** (plan-088, fixes TES-75). PrimeVue's `<Step :value=...>` renders the value as the visible step number, so the three steps anchor at `1`, `2`, `3` — matching natural-language references in the in-step headings ("Step 1: Basic Info", etc.) and in this doc. `activeStep` ref initialises to `1`; `nextStep`/`prevStep` use `++`/`--` arithmetic on the 1-based range. Future Stepper additions should follow the same convention so badges always show `1, 2, ...`.
- **Context-aware back button** (plan-086, fixes TES-80): the page-header back button derives its label and destination from `route.query.projectId`. With the param → **Back to Project Overview** → `/projects/:id`; without → **Back to Test Runs** → `/test-runs`. A `data-testid="create-back-btn"` is on the button. Explicit `router.push` (not `router.back()`) so deep-link entry has a sensible destination too.
- A TestRun requires: **name**, **project**, and at least one test case selected.
- **Case selection (Step 2)**: implemented via `TestSuiteTreeSelector` (plan-045) — a recursive tree that renders every suite and its test cases as rows with PrimeVue Checkboxes. Key behaviours:
  - **Suite-level auto-check**: checking a suite header automatically selects all descendant case IDs (across all depth levels); unchecking deselects them.
  - **Indeterminate state**: a suite checkbox shows the indeterminate (`–`) state when some but not all of its descendant cases are selected, giving a clear partial-selection signal.
  - **Lazy loading**: cases under a suite are fetched on first expansion (`fetchTestCasesBySuite`) and cached in `testCasesStore.casesBySuite`. This avoids loading the entire project's case set upfront.
  - **Flat selection model**: the selection source of truth is a `Set<number>` of case IDs. The store knows nothing about suite hierarchy — the composable `useSuiteSelection` owns the propagation logic.
  - **Filters narrow visibility, not selectability**: any active filter (search, priority, type, etc.) hides non-matching cases from the tree view but does not forcibly deselect them. Propagation helpers use `visibleCaseIds` so suite auto-check only touches currently visible rows.
  - The previous DataTable + suite dropdown for case selection has been replaced entirely by this tree.
- **Environment config** is stored as an arbitrary key-value map (`config: Record<string, string>`). Common keys: `browser`, `os`, `build`, `environment`. No fixed schema is enforced.
- **Tester assignment**: a single user is assigned to execute the run. Defaults to the current user.
- **Milestone**: optional link to a Milestone record.
- On creation, each selected TestCase gets a corresponding TestResult initialised with status `Untested`.
- The test run list (`TestRunListView` at `/test-runs`) supports filtering by status, project, and date range.
- `TestRunDetailView` shows run metadata, progress bar, and the list of results.
- **Delete**: the list view exposes a trash action column per row; the detail view has a header Delete button that redirects to `/test-runs` on success. Both go through PrimeVue `useConfirm()` with a cascade warning ("this will also delete all results in this run"); `canManageTests` role guard.
- **Edit run metadata**: the detail view header exposes an "Edit Run" button (gated on `canManageTests`, which maps to tester/lead/admin — matching the backend's `_TESTER` tuple on `PUT /test-runs/{run_id}`). The button opens `EditTestRunDialog` (`src/components/test-runs/EditTestRunDialog.vue`) pre-filled with the current run's name and config (environment, browser, build number). Save sends only the changed fields via `testRunsStore.updateTestRun` → `PUT /test-runs/{run_id}`; the cached run and `currentTestRun` are replaced with the server response. Status transitions are intentionally not exposed here — they remain driven by the execute and close flows.

- **Edit cases after creation**: the detail view also exposes an "Edit Cases" button (same `canManageTests` gate) that opens `EditRunCasesDialog` (`src/components/test-runs/EditRunCasesDialog.vue`). The dialog hosts the same `TestSuiteTreeSelector` the create wizard uses, pre-selected to the run's current cases. Save issues `PUT /test-runs/{id}/cases` with the full `test_case_ids` list (replace semantics) and then refreshes the run, progress, and cases list. First PUT flips the run's `cases_mode` from `auto` to `explicit` (backend behaviour). Cross-project case ids are rejected by the backend with 400.
- **Empty-run creation** (plan-069): the wizard's step 2 (case selection) is explicitly skippable. When 0 cases are selected, step 2 shows a "Skip — create without cases" button alongside a re-labelled "Next with 0 cases" primary, making the empty path explicit. Step 3 renders "No cases selected — you can add them from the run detail page after creation." The submit payload always sends `include_test_cases: [...selectedCaseIds]`, so `[]` serialises cleanly and the backend records `cases_mode === "explicit"`. On the detail page, an empty run renders an "Add Cases" primary CTA in `TestResultsList`'s empty-state (gated on `canEditCases`); the CTA emits `@edit-cases`, which the detail view wires to open `EditRunCasesDialog`.
- **Block when the project has no cases anywhere** (plan-092, fixes TES-76): the empty-run path (plan-069) is only valid when the project actually has cases to come back and pick. When the project has zero cases project-wide (either no suites at all, or suites exist but every suite is empty), the `projectHasNoCases` computed flips true and both step-2 proceed buttons (`create-skip-cases-btn`, `create-next-btn`) are `:disabled`. The empty-state hint above the action row adapts its copy to the cause — "No test suites available. Create test suites and test cases first." vs. "No test cases available. Add test cases to this project before creating a run." Predicate keys on `Object.values(testCasesStore.casesBySuite).flat().length === 0`, not on `selectedCaseIds.size`, so a project with cases + zero selection (the intentional plan-069 path) is never blocked. Buttons stay visible (just disabled), matching the "you can't do this right now and here's why" pattern used by Save buttons in Edit dialogs.
- **"Manual cases" badge** (plan-069): when a run's `cases_mode === "explicit"` (first PUT on `/test-runs/{id}/cases` flipped it from `auto`), `TestRunDetailView` renders a small secondary `<Tag>` next to the run name clarifying that the case list was set manually and no longer derives from a suite.
- **Lifecycle statuses**: `planned` (fresh run, no results yet), `active` (first result submitted — auto-transitioned backend-side), `completed` (manually marked), `aborted` (cancelled). The old `in_progress` value is normalised to `active` at the API-adapter boundary (`normaliseRunStatus` in `src/api/testRuns.ts`) so the rest of the app only ever sees the canonical name. `TestRunExecutionView.submitResult` optimistically flips a `planned` run to `active` on the user's first submit; the subsequent `fetchTestRun` confirms the transition. `active` renders with `warning` (orange) severity across badges and status chips to signal "in flight".
- **Edit Cases dialog always refetches on open** (plan-077): every time the dialog opens — from the test-runs list row action or the detail-page header — it unconditionally refetches suites (`testSuitesStore.fetchTestSuites`) and cases per suite (new `testCasesStore.refreshCasesBySuite`, which bypasses the per-suite cache). This means a case added or removed in another tab/session appears on the next open without a page reload. Pre-selected ids that no longer correspond to an existing case are silently pruned and a warning toast surfaces the drop count. On-demand suite expansion (`handleExpandSuite`) still uses the cached path — only the open-time fan-out is forced.

## Constraints / edge cases

- A TestRun's case list can be rewritten after creation via `PUT /test-runs/:id/cases` (replace semantics, no dedicated add/remove endpoint). Removing a case from the run also removes its TestResult.
- `TestRunStatus`: `planned` (scaffolded, no results), `active` (at least one result — flipped automatically on first submit), `completed` (all results recorded / manually closed), `aborted` (cancelled). Legacy `in_progress` responses normalise to `active` on read.
- Progress is computed as `(passed + failed + blocked + skipped) / total`; `Untested` cases do not count toward progress.
- Deleting a test run also deletes all its TestResults (cascade).
- The same TestCase can appear in multiple TestRuns; each appearance creates an independent TestResult.
- Milestone linkage is optional and does not affect run execution.

## Related docs

- `docs/06-generated/api-schema.md` — `testRuns` API endpoints
- `docs/06-generated/routes-map.md` — `/test-runs`, `/test-runs/create`, `/test-runs/:id`
- `src/stores/testRuns.ts`
- `src/api/testRuns.ts`
- `src/views/TestRunCreateView.vue`, `TestRunListView.vue`, `TestRunDetailView.vue`
- `docs/01-product/features/006-test-execution.md` — execution phase that follows planning
