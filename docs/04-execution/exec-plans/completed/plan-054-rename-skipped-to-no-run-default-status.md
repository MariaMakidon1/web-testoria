# Execution Plan: Rename `skipped` → `no_run` and make it the default status

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Replace the `skipped` test-result status with `no_run` across every place the frontend surfaces it (types, constants, pickers, progress bar, stats, exports, badges, overall-status suggestion) and make `no_run` the default selection in the execution UI, so a tester pressing Enter / submitting without an explicit pick records `no_run`.

---

## Context

Today, `ResultStatus = "passed" | "failed" | "blocked" | "skipped"` (`src/types/testResult.ts:25`). The four values are enumerated and duplicated across:

- `RESULT_STATUSES`, `RESULT_STATUS_COLORS`, `RESULT_STATUS_ICONS`, `RESULT_STATUS_LABELS` in `src/types/testResult.ts`
- `--status-skipped` CSS var in `src/assets/styles/variables.css:49`
- `StatusBadge.vue` severity/icon map (`src/components/common/StatusBadge.vue:27`)
- `TestRunProgressBar.vue` segment config
- `StepStatusPicker.vue` key list (`src/components/test-runs/StepStatusPicker.vue:22`)
- `TestRunExecutionView.vue` keyboard handler + button (`:910`, `:497`, `:621`)
- `useOverallStatusSuggestion.ts` (all-skipped → skipped rule)
- Stats reducers in `stores/testResults.ts`, `TestResultsList.vue`, `DashboardView.vue`, `TestRunDetailView.vue`
- Export color maps in `usePdfExport.ts` and `useExcelExport.ts` (labels + color keyed by `skipped`)
- `testRun.ts` + `report.ts` progress/summary types carrying a `skipped` field

Two conceptually distinct things share the word "no result" today:
- **`skipped`** — tester explicitly marked the case as skipped (has a `TestResult` row)
- **`untested`** — derived: case in run with no `TestResult` yet (count = `total - results.length`)

The user's intent: rename `skipped` → `no_run`, keep `untested` as the derived "no result row yet" concept (renaming `untested` is **out of scope**), and make `no_run` the default picked status in the execution picker. This is a coupled change — the backend plan (api `032-be-rename-skipped-to-no-run.md`) must land in the same release, because the string value travels on the wire.

---

## Scope

### In scope
- Rename the enum value `"skipped"` → `"no_run"` in `src/types/testResult.ts` (and every map keyed by it)
- Update the UI label to `"No Run"` and icon (keep `pi pi-minus-circle` — semantically still fits)
- Update the CSS token name `--status-skipped` → `--status-no-run` (keep the color value `#9ca3af`)
- Update every reducer / stats object field `skipped` → `no_run` in `testRun.ts`, `report.ts`, stores, components, dashboards
- Update export color maps (PDF/Excel) keys + labels
- Update keyboard shortcut / button in `TestRunExecutionView.vue` (current `S` key → decide: keep `S` or switch to `N` — see Key decisions)
- Make `no_run` the **default** status in the execution picker: when no explicit status is chosen and the user submits, record `no_run`. Concretely:
  - Pre-select `no_run` in the status picker on case load
  - If the overall-status suggestion has no signal (empty step list, all-null), fall back to `no_run` instead of `null`
- Update `useOverallStatusSuggestion.ts` — rename the all-skipped rule to all-no-run → `no_run`
- Unit tests updated to use the new value; add one test covering the new default-to-`no_run` behaviour on empty submit
- `StepStatusPicker` also renames `skipped` → `no_run` for per-step status (consistency)

### Out of scope
- Renaming or merging `untested` with `no_run` — these remain distinct concepts (no-row vs row-with-status). Revisit if product asks.
- Changing the color of `no_run` — keep `#9ca3af`
- Backend work — covered by api plan 032; this plan assumes that API ships the new literal and a data migration for existing rows
- Recoloring or relabelling other statuses
- CLI-side changes (if any)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testResult.ts` | `ResultStatus` union: `"skipped"` → `"no_run"`; `RESULT_STATUSES`, `_COLORS`, `_ICONS`, `_LABELS` renamed/relabelled ("No Run") |
| types | `src/types/testRun.ts` | `TestRunProgress.skipped` → `no_run` |
| types | `src/types/report.ts` | All `skipped` fields on summary/report shapes → `no_run` |
| tokens | `src/assets/styles/variables.css` | `--status-skipped` → `--status-no-run` (same hex) — search and replace downstream consumers |
| stores | `src/stores/testResults.ts` | Stats reducer: `skipped` count → `no_run` |
| composables | `src/composables/useOverallStatusSuggestion.ts` | All-same-status rule returns `no_run`; add default-to-`no_run` when input is empty |
| composables | `src/composables/usePdfExport.ts` | `statusColors.skipped` key → `no_run`; label map → "No Run"; reducer on line 409 |
| composables | `src/composables/useExcelExport.ts` | Same rename; reducer on line 165 |
| components | `src/components/common/StatusBadge.vue` | Severity/icon map key `skipped` → `no_run`; label |
| components | `src/components/test-runs/TestRunProgressBar.vue` | Segment key + aria label |
| components | `src/components/test-runs/TestResultsList.vue` | Stats reducer |
| components | `src/components/test-runs/StepStatusPicker.vue` | `{ key: "no_run", label: "No Run", short: "N" }` — replaces the `S/Skipped` entry |
| views | `src/views/test-runs/TestRunExecutionView.vue` | Replace all `'skipped'` string literals; button label "No Run"; default pick = `no_run`; keyboard binding (see Key decisions) |
| views | `src/views/test-runs/TestRunDetailView.vue` | Stats field rename |
| views | `src/views/dashboard/DashboardView.vue` | Status distribution chart label + reducer field |
| tests | `tests/unit/**` | Every mock/fixture with `status: "skipped"` → `"no_run"`; new test: submitting with no pick records `no_run` |
| e2e | `tests/e2e/**` | Update any selector/label asserting "Skipped" → "No Run" |

### Key decisions

- **Wire value: `no_run` (snake_case)**. Matches the API-side Pydantic `Literal` and avoids a web-only translation layer. TS union and JSON both carry `"no_run"`.
- **Display label: `"No Run"`**. Title-cased two-word label, consistent with existing labels (`"Passed"`, `"Blocked"`). Not `"Not Run"` (user said "no run"), not `"NoRun"`.
- **CSS token renamed to `--status-no-run`** (hyphenated) — CSS custom properties already use kebab-case. Color value **unchanged** (`#9ca3af`). A repo-wide grep for `--status-skipped` catches consumers.
- **Keyboard shortcut**: current `Skipped` is bound to `S`. `no_run` fits `N` better, but `P/F/B/N` reads fine (Pass/Fail/Blocked/No-run). **Choose `N`**; add a note in `KeyboardShortcutsDialog`. Change requires updating both the key handler in `TestRunExecutionView.vue` (`:910` area) and the dialog help text.
- **Default = `no_run`**: the picker's initial value is `no_run` on case load (instead of `null`). This means a tester who hits "submit" without touching the picker now explicitly records `no_run` rather than leaving the case untested. **This is a behaviour change** — tech debt entry: document in feature doc and release notes so testers aren't surprised.
- **Do NOT rename `untested`**: it remains the derived "no TestResult row exists yet" count. `no_run` is "a row exists with status = no_run". Keeping both concepts preserves the ability to tell "tester hasn't touched it" from "tester explicitly chose no_run".
- **Coordinated release with api plan 032**: the string value is shared. Merge order: API migration + schema literal change first (backward-compat accepts both during the transition if feasible), then web. See Risks for the compat strategy.
- **No color or icon change**: same gray, same `pi pi-minus-circle`. Minimises visual surprise; the intent is a label/semantics rename, not a re-theme.

---

## Tasks

### Implementation
- [ ] Confirm API plan 032 is merged (or at least the Pydantic literal accepts `no_run`) before starting the frontend merge
- [ ] Update `src/types/testResult.ts`: union, `RESULT_STATUSES`, `_COLORS`, `_ICONS`, `_LABELS`
- [ ] Update `src/types/testRun.ts` + `src/types/report.ts` field rename `skipped` → `no_run`
- [ ] Rename CSS var in `src/assets/styles/variables.css` (light + dark-mode block) `--status-skipped` → `--status-no-run`; repo-wide grep and update any direct `var(--status-skipped)` references
- [ ] Update every stats reducer (`stores/testResults.ts`, `views/test-runs/TestRunDetailView.vue`, `views/test-runs/TestRunExecutionView.vue`, `components/test-runs/TestResultsList.vue`, `views/dashboard/DashboardView.vue`)
- [ ] Update `components/common/StatusBadge.vue` severity/icon map
- [ ] Update `components/test-runs/TestRunProgressBar.vue` segment key + aria label string
- [ ] Update `components/test-runs/StepStatusPicker.vue` — replace the `skipped/S/Skipped` entry with `no_run/N/No Run`
- [ ] Update `composables/useOverallStatusSuggestion.ts` — rename rule; add default-when-empty → `no_run`
- [ ] Update `composables/usePdfExport.ts` — key rename, label rename, reducer field
- [ ] Update `composables/useExcelExport.ts` — key rename, label rename, reducer field
- [ ] Update `views/test-runs/TestRunExecutionView.vue`:
  - Replace every `'skipped'` literal
  - Change button label to "No Run"
  - Initialise picker value to `"no_run"` (was `null`)
  - Rebind the keyboard shortcut from `S` to `N`; update `submitResult('skipped')` callsite
- [ ] Update `KeyboardShortcutsDialog` (if it lists `S = Skipped`) → `N = No Run`
- [ ] Repo-wide grep for any remaining `skipped` string literals tied to test results; fix or justify
- [ ] Update every unit-test fixture / assertion using `"skipped"`
- [ ] New unit test: execution picker submits `no_run` when no explicit status is chosen
- [ ] New unit test: overall-status suggestion returns `no_run` when all step statuses are `no_run`, and when input is empty
- [ ] Update e2e test labels/selectors referring to `"Skipped"`
- [ ] Run a visual sweep in dev against a seeded run: badges, progress bar, PDF export, Excel export, dashboard chart, execution view — every prior "Skipped" now shows "No Run" and defaults correctly

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (vue-tsc must fail if any `"skipped"` literal survives in a `ResultStatus` context)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` updated — status enum on test-result create/update/response now `no_run` instead of `skipped`
- [ ] `docs/01-product/features/006-test-execution.md` updated — status list, default behaviour documented
- [ ] `docs/01-product/features/009-result-history.md` updated if it names the statuses
- [ ] `docs/02-architecture/ARCHITECTURE.md` — "Key types" section if it enumerates the status union
- [ ] `docs/07-references/llm/design-system.txt` — status section: relabel, note default
- [ ] `docs/08-decisions/changelog.md` — record: renamed for clarity (`skipped` was ambiguous vs `untested`), new default behaviour for executions, coordinated with api plan 032
- [ ] `docs/04-execution/tech-debt.md` — if anything deferred (e.g. merging `untested` into `no_run`), log it
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

*(No routes-map update — no route changes.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Frontend ships before API migration; POST `{ status: "no_run" }` is rejected as 422 | High if ordering slips | Gate merge on api plan 032 being deployed; keep feature flag / compatibility window if merges overlap |
| Old `TestResult` rows still hold `status="skipped"` after FE switch; UI breaks on unknown status | High if no backend migration | API plan 032 includes a data migration; FE still maps unknown status to generic badge as a safety net |
| A hardcoded `"skipped"` literal survives in a Vue template or export string and silently shows "Skipped" after rename | Medium | vue-tsc catches typed sites; explicit grep step in tasks for template/string literals |
| Default-to-`no_run` surprises existing testers who expect submit-without-pick to be a no-op | Medium | Release note / in-app tooltip on first use; keyboard shortcut `N` still requires an explicit keypress — only programmatic submit uses the default |
| Keyboard `N` collides with an existing binding | Low | Check `KeyboardShortcutsDialog` + keyboard handler map before rebinding; fall back to `S` if `N` is taken (and note in dialog that "S" now means No Run) |
| PDF / Excel exports open with old cached color map | Low | Color value unchanged; only the key and label change — visual output identical |
| Dashboard chart legend still says "Skipped" because the label string was pulled from a different source | Low | Dashboard labels list at `views/dashboard/DashboardView.vue:124` is updated in the task list |

---

## Definition of done

- [ ] `grep -r "skipped" src/` returns only non-status matches (e.g. unrelated wording in comments) — every test-result status is `no_run`
- [ ] `grep -r "Skipped" src/` returns no user-facing label for test-result status
- [ ] Submitting a case in the execution view without touching the picker records `status = "no_run"`
- [ ] Keyboard `N` submits `no_run`; dialog reflects the new binding
- [ ] Progress bar, badges, stats, exports, dashboard chart all show "No Run" and the same gray color
- [ ] Unit + e2e tests pass with the new value
- [ ] API plan 032 merged and deployed before this plan's PR merges to main
- [ ] Docs updated
- [ ] PR checklist completed
