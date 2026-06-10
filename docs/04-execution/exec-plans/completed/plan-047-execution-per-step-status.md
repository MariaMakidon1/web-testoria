# Execution Plan: Per-Step Status Picker on Test Run Execution Page

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs/:id/execute`, let the tester mark each individual test step as Passed / Failed / Blocked / Skipped (with an optional per-step comment) and submit those outcomes alongside the overall test case result, so reviewers can see exactly where a case went wrong instead of just "the case failed".

---

## Context

The execution view today renders each test case's steps read-only (`src/views/test-runs/TestRunExecutionView.vue:745–766`) — a numbered list with `Action` and `Expected` text, nothing interactive. The only status the tester can set is the **overall** case result.

That loses information. A 10-step login flow that fails on step 7 looks identical in the data to one that fails on step 2. Testers work around it by typing step numbers into the free-text comment, which nobody aggregates.

This plan adds a per-step status picker next to each step and threads the outcomes through the existing create/update-result flow. It depends on the companion backend plan `api-testoria/docs/04-execution/exec-plans/active/026-be-test-result-per-step-status.md`, which adds a `step_results: list[StepResult] | null` field to `TestResult` (JSON, index-based, partial coverage allowed, overall status stays manually set).

---

## Scope

### In scope
- Interactive status picker on every step row in the execution view (the four statuses as small buttons, plus a clear/reset)
- Optional short comment per step (collapsed by default, expands on click)
- Local state for the in-progress per-step selections, keyed by case id, so the tester can navigate away from a case and come back without losing marks
- Submit per-step results as `step_results: [{index, status, comment}]` in the existing create/update payload
- Hydrate the picker from an already-submitted result when the tester revisits a case (edit mode)
- "Suggest overall status" affordance: a small button that fills the overall case status from the per-step outcomes using a deterministic rule (any failed → failed; else any blocked → blocked; else all skipped → skipped; else all passed → passed; else leave unchanged). Tester can accept or ignore — overall status stays manually controlled.
- Unit test the suggestion rule as a pure function; e2e for the round-trip (mark steps, submit, reload, marks still shown)

### Out of scope
- Requiring every step to be marked before allowing submission (partial coverage is explicitly allowed by the backend)
- Per-step attachments
- Per-step history / audit trail
- Bulk "mark all remaining as passed" (nice-to-have; defer)
- Running a diff between the previous result's `step_results` and the new one

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testResult.ts` | Add `StepResult { index: number; status: 'passed' \| 'failed' \| 'blocked' \| 'skipped'; comment?: string \| null }` and thread `step_results?: StepResult[] \| null` through `TestResult`, `TestResultCreate`, `TestResultUpdate` |
| api | `src/api/testResults.ts` | No signature change — payloads pass through; verify via TS that the new field is accepted |
| store | `src/stores/testResults.ts` | New local state `stepResultsDraft: Map<caseId, StepResult[]>` to keep in-progress marks per case; helpers `setStepStatus(caseId, index, status)`, `setStepComment(caseId, index, comment)`, `clearStep(caseId, index)`, `hydrateFromResult(caseId, result)` |
| components | `src/components/test-runs/StepStatusPicker.vue` (new) | Props: `status`, `comment`, emits `update:status`, `update:comment`, `clear`; renders four small buttons (P/F/B/S) plus a comment icon that toggles a small textarea |
| views | `src/views/test-runs/TestRunExecutionView.vue` | In the existing step-list block (lines ~745–766), add `<StepStatusPicker>` per step bound to `testResultsStore.stepResultsDraft.get(caseId)?.[index]`; on overall-submit, serialize the draft into the `step_results` payload; add a "Suggest overall status" button next to the overall status picker; hydrate the draft from an existing result when a case is selected |
| composables | `src/composables/useOverallStatusSuggestion.ts` (new) | Pure function `suggestOverallStatus(stepResults: StepResult[], stepCount: number): Status \| null` implementing the rule above; unit-testable without Vue |

### Key decisions

- **State lives in the store, not the component**: the tester navigates between cases (`selectedTestCase` changes in the existing view). If the picker state lived on the component, it would reset on every switch. The store keeps a `Map<caseId, StepResult[]>` that survives navigation and only clears on run exit.
- **Index-based keying matches the backend**: per the companion backend plan, `StepResult` uses an integer `index` into the case's step list. The frontend never invents step ids; it uses the same index the template already iterates on (`v-for="(step, index) in selectedTestCase.steps"`).
- **Partial coverage is valid**: sending `step_results: [{index: 6, status: 'failed'}]` for a 10-step case is allowed. The store only emits entries for steps the tester explicitly marked. Unmarked steps are omitted, not included as `null`.
- **Clear vs skip**: clicking the currently-selected status button clears the mark (state: unmarked). Picking `skipped` is an explicit tester action, different from "not yet marked". The picker surfaces this distinction visually (unmarked = neutral; skipped = gray with check).
- **Comment is lazy-rendered**: avoid rendering N textareas when the tester only wants to comment on one or two steps. Collapsed by default; an icon expands it. When expanded and saved, it sits under the step row.
- **Overall status remains manual**: per the backend decision, per-step data does not automatically update `TestResult.status`. We provide a "Suggest" button that *populates* the overall status control from the step outcomes — tester can accept or override. Never auto-submit.
- **Hydration on revisit**: when the tester reselects a case that already has a result, call `hydrateFromResult(caseId, existingResult)` to prime the draft from `existingResult.step_results`. Changes from then on go to the draft; on submit, the draft replaces the existing list (the backend treats `step_results` as a full replacement per companion plan).
- **Status color palette reused**: the four status buttons use the same color tokens as the segmented progress bar from `plan-104-test-run-segmented-progress-bar.md` — consistency across the run UI.
- **Picker is a standalone component**: small, reusable, unit-testable in isolation. Keeps `TestRunExecutionView.vue` (already 1500+ lines) from growing a new responsibility.

---

## Tasks

### Implementation
- [x] Add `StepResult` type and extend `TestResult*` interfaces in `src/types/testResult.ts`
- [x] Confirm `src/api/testResults.ts` payloads carry the new field once types are updated (TS will flag gaps)
- [x] Add `stepResultsDraft: Map<number, StepResult[]>` and helper actions to `src/stores/testResults.ts`
- [x] Create `src/composables/useOverallStatusSuggestion.ts` with the pure suggestion function
- [x] Unit-test the suggestion function — empty, all passed, one failed, mixed, all skipped, partial coverage
- [x] Create `src/components/test-runs/StepStatusPicker.vue`:
  - Four small buttons with status-color tokens and accessible labels
  - Comment icon toggling a short textarea (200-char soft cap, 1000-char hard cap matching backend)
  - Emits `update:status`, `update:comment`, `clear`
- [x] Update the step list in `src/views/test-runs/TestRunExecutionView.vue` (lines ~745–766):
  - Mount `<StepStatusPicker>` per step, bound to the store draft
  - Hydrate the draft when `selectedTestCase` changes and an existing result is present
  - On submit, serialize the draft into the `step_results` array (only marked entries)
  - After a successful submit, keep the draft in sync with the persisted result (re-hydrate)
- [x] Add the "Suggest overall status" button next to the existing overall status control; uses `useOverallStatusSuggestion`; fills the overall picker but does not auto-submit
- [x] Unit-test the store actions (setStepStatus, hydrateFromResult, clearStep, serialize)
- [x] Component test for `StepStatusPicker` (button clicks emit events, comment toggle works, accessibility labels present)
- [x] e2e: `tests/e2e/test-run-per-step-status.spec.ts` — open execution page, mark some steps, submit, reload, verify marks and overall status persist

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke against real backend: mark a subset of steps, submit, confirm via the detail page that steps round-tripped
- [x] Dark mode smoke check on the status button colors

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` — note the `step_results` field on `TestResult*` types
- [x] `docs/01-product/features/test-execution.md` — describe the per-step picker, the partial-coverage rule, and the suggestion button
- [x] `docs/02-architecture/ARCHITECTURE.md` — add `StepStatusPicker` and `useOverallStatusSuggestion` to the codemap and "Where is X?" table
- [x] `docs/03-engineering/patterns/composables.md` — note the pure-logic suggestion composable pattern if novel
- [x] `docs/08-decisions/changelog.md` — record: store-scoped draft, index-based keying, partial coverage, suggest-not-auto, hydration on revisit, standalone picker component
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map update — no route changes.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend plan 026 not yet merged when this lands | High | Sequence: backend plan ships first; gate this plan's merge on backend availability in the target environment |
| Tester navigates away mid-case and loses marks | Medium | Draft lives in the store keyed by case id — survives navigation within the same run |
| Case steps reorder after a result exists, indices point at wrong rows | Medium | Documented limitation; same mitigation as backend plan (track stable step ids as future tech debt) |
| Submitting overwrites step_results the tester intended to preserve | Medium | Hydrate on revisit + full replacement on submit; unit test that hydration then re-submit yields the same list |
| Comment textareas create layout churn | Low | Collapsed by default; expand on click; only one comment visible at a time is fine but not required |
| "Suggest" button surprises users by overwriting a carefully chosen overall status | Medium | The button fills the overall picker but does not submit; tester can reject by picking something else before submitting |
| Performance degrades for cases with many steps | Low | Picker is lightweight (four buttons + lazy textarea); cap realistic step counts; no per-step watchers |

---

## Definition of done

- [x] Every step on the execution page shows an interactive status picker with four options and a comment toggle
- [x] Marks persist across case navigation within the same run
- [x] Submitting a result sends `step_results` to the backend; reloading the page restores the marks from the persisted result
- [x] Partial coverage works — the tester can mark one step and submit without marking the rest
- [x] The "Suggest overall status" button fills the overall picker correctly for all rule branches
- [x] Overall status is never auto-submitted; the tester remains in control
- [x] All hard invariants respected — no component imports from `src/api/`
- [x] Unit tests for the suggestion function, store actions, and picker component pass
- [x] e2e covers mark-submit-reload round trip
- [x] PR checklist completed
- [x] Docs updated
