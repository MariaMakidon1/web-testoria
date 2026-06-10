# Execution Plan: Block Test Run Wizard When Project Has No Cases (TES-76)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

When the current project has zero test cases anywhere, the **Select Test Cases** step of the Create Test Run wizard must block forward progress — both the `Skip — create without cases` button and the `Next with 0 cases` button are disabled, the warning copy is adapted to match the actual cause, and the user is steered toward creating a suite/case first. The intentional **empty-run** feature (plan-069) is preserved: when the project *does* have cases and the user simply chooses none, both buttons stay enabled.

Linear: [TES-76](https://linear.app/testoria/issue/TES-76/test-run-wizard-allows-proceeding-with-0-test-cases-despite-showing-a) — Bug, Medium. Parent: TES-68. Ref: Alex's POC review 2026-04-28 — BUG-001.

---

## Context

`src/views/test-runs/TestRunCreateView.vue` step 2 already renders the empty-state hint *"No test suites available. Create test suites and test cases first."* when `testSuitesStore.testSuites.length === 0`. The hint sits directly above the same `.step-actions` row that contains `Skip — create without cases` and `Next with 0 cases` — which remain fully active. A user reading the hint, then clicking either button, creates a run in a project that has nothing to run, then lands on the run detail page with no `Add Cases` affordance (because there are no cases to add). The wizard's guidance and its affordances disagree.

Two distinct empty states reach this screen today:

1. **Project has no suites at all.** `testSuites.length === 0`. Hint already shown; buttons must be blocked.
2. **Project has suites but every suite is empty.** `testSuites.length > 0` and `Object.values(casesBySuite).flat().length === 0`. Today neither hint nor block is shown — the tree just renders empty suite rows with no cases. Same semantic problem as case 1; same fix.

Plan-069's empty-run path is for the third scenario: **project has cases, user selects none**. That stays untouched — buttons remain enabled, step 3 renders the "you can add them from the run detail page after creation" hint, and creation proceeds.

The fix is a single computed plus the `:disabled` binding on the two proceed buttons, with the warning copy adapted to the cause.

---

## Scope

### In scope

- Add `projectHasNoCases` computed in `TestRunCreateView.vue` — true when the project has zero cases anywhere (across all loaded suites).
- Adapt the empty-state hint copy so it matches the actual cause:
  - No suites → existing copy (*"No test suites available. Create test suites and test cases first."*)
  - Suites exist but no cases anywhere → *"No test cases available. Add test cases to this project before creating a run."*
  - Surface the hint above the action row in both cases (today it only renders for the no-suites case).
- Disable `Skip — create without cases` and `Next with 0 cases` when `projectHasNoCases` is true.
- Add a Playwright e2e case asserting the buttons are disabled when a project has no cases.
- Add a Vitest unit-ish test through the component if the existing pattern supports it, otherwise rely on the e2e for the user-visible behaviour (the wizard view has no existing unit test today).

### Out of scope

- Changing the empty-run feature (plan-069) for projects that do have cases. The `selectedCaseIds.size === 0` path stays enabled when `!projectHasNoCases`.
- Inline "Create Test Suite" / "Create Test Case" CTAs inside the wizard. Useful, but a separate UX scope — the existing "back to project overview" / "back to test runs" cancel path is sufficient.
- Backend changes. The API correctly supports empty runs by design (BE plan 034 + FE plan 069). The bug is purely client-side UX.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/test-runs/TestRunCreateView.vue` | Add `projectHasNoCases` computed; bind `:disabled="projectHasNoCases"` on Skip + Next buttons; adapt the `empty-message` block to two copy variants based on whether suites exist |
| tests | `tests/e2e/test-runs.spec.ts` | Add a case that mocks/uses a project with no cases and asserts the proceed buttons are disabled on step 2 |
| docs | `docs/01-product/features/005-test-run-planning.md` | Note the block: wizard cannot proceed past step 2 when the project has no cases; the empty-run feature (plan-069) still works when the project has cases |

### Key decisions

- **`projectHasNoCases` is derived from cases, not suites.** `Object.values(testCasesStore.casesBySuite).flat().length === 0` is the source of truth. This covers both scenarios (no suites; suites but no cases) with one predicate. The `loadCasesForAllSuites` fan-out on project change/mount means the predicate is reliable by the time the user reaches step 2.
- **Two warning copy variants, chosen by which empty state we're in.** Reusing the existing copy when there are no suites preserves the existing user-visible string (and any matching e2e selectors). Adding a second variant when suites exist but are empty closes the silent-failure case where today the tree renders nothing and the user has no idea why.
- **`:disabled` on the buttons, not `v-if`.** Keeps the buttons visible so the user understands the action is intentionally blocked, not missing. Matches PrimeVue's standard "you can't do this right now and here's why" pattern (cf. Save buttons in Edit dialogs disabled when nothing has changed). The existing `v-if="selectedCaseIds.size === 0"` on the Skip button stays — Skip only makes sense in the zero-selection state regardless of cause.
- **Preserve plan-069's empty-run path when the project has cases.** The `Next with 0 cases` label still appears (and the Skip button still mounts) when the user has cases available but selects none. Only `:disabled` flips based on `projectHasNoCases` — the labels and visibility logic are unchanged.
- **One `data-testid` reused.** `create-skip-cases-btn` and `create-next-btn` already exist; tests assert `toBeDisabled()` rather than introducing new selectors.

---

## Tasks

### Implementation
- [x] In `src/views/test-runs/TestRunCreateView.vue`:
  - [x] Add `const projectHasNoCases = computed(...)` near the other computeds
  - [x] Replace the `v-if="testSuitesStore.testSuites.length === 0"` empty-message block with a `v-if="projectHasNoCases"` block whose text adapts based on whether suites exist
  - [x] Add `:disabled="projectHasNoCases"` to the `Skip — create without cases` button
  - [x] Add `:disabled="projectHasNoCases"` to the `Next` button on step 2
- [x] Spot-check by opening `/test-runs/create?projectId=<id>` in dev against (a) a project with no suites, (b) a project with empty suites, (c) a project with cases — confirm only (a) and (b) block

### Tests
- [x] In `tests/e2e/test-runs.spec.ts` (or a sibling spec): a case that
  - [x] Routes to `/test-runs/create?projectId=<id>` for a project with no cases
  - [x] Advances to step 2
  - [x] Asserts the warning text is visible
  - [x] Asserts `[data-testid="create-skip-cases-btn"]` is disabled
  - [x] Asserts `[data-testid="create-next-btn"]` is disabled

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/005-test-run-planning.md` — note the block; cross-reference plan-069 to clarify the intentional empty-run path
- [x] `docs/08-decisions/changelog.md` — plan-092 entry
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Computed reads `casesBySuite` before `loadCasesForAllSuites` resolves, briefly reporting "no cases" while loading | Low | `loadCasesForAllSuites` is awaited in `onMounted` and in the project-change watcher; the user has to click through step 1 before reaching step 2, by which point the fan-out is resolved. The computed re-evaluates as cases land, so any transient state self-corrects |
| Mistakenly blocking the intentional empty-run path (plan-069) | Low | The predicate keys on `casesBySuite` (project-wide), not `selectedCaseIds.size`. A project with cases will have `casesBySuite` populated and `projectHasNoCases` will be false |
| `casesBySuite` retains stale entries from a previously-selected project, masking a real empty state | Very low | The project-change watcher already calls `testCasesStore.clearCasesBySuite()` before fetching the new project's data |
| E2E flake if the test project's cases load slowly | Low | Use the existing project-with-no-cases fixture pattern; wait on `[data-testid="create-skip-cases-btn"]` to be present before asserting disabled state |

---

## Definition of done

- [x] On step 2 of `/test-runs/create`, `Skip — create without cases` and `Next with 0 cases` are disabled when the project has zero cases anywhere
- [x] Warning copy adapts to "no suites" vs "no cases in any suite"
- [x] Empty-run creation (plan-069) still works for projects that have cases
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Playwright e2e covers the blocked state
- [x] Feature doc + changelog updated
- [x] TES-76 marked Done in Linear with the merge commit linked
