# Execution Plan: Execution View — Persist Per-Step Status on Save

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs/:id/execute`, make the Save button react to per-step status changes and actually persist those changes through the API — fixing the "click a step status → Save stays disabled → changes lost" regression.

---

## Context

Per-step status picker was introduced by api-testoria plan-026/031 (backend) and `StepStatusPicker.vue` on the web side. The backend contract is complete and tested:
- `TestResultUpdate` schema accepts `step_results: list[StepResult] | None`
- `test_result_service.update_result()` validates, normalises (`skipped` → `no_run`), and persists the JSON column on `test_results`
- Integration tests confirm both create and update paths work end-to-end

The frontend has two independent defects in `src/views/test-runs/TestRunExecutionView.vue`, both in the "comment panel save" code path only. The separate full "submit result" flow (used when the overall result status is changed and submitted) already includes `step_results` and works correctly.

**Defect 1 — Save button never enables for step-only changes** (`TestRunExecutionView.vue:81-108`):
`commentPanelIsDirty` compares only the current comment, defect key, and attachments against the loaded result. It does not compare `testResultsStore.stepResultsDraft[caseId]` against `existingResult.step_results`, so clicking a step status button doesn't flip the dirty flag. Save button (bound at line ~1000 via `:disabled="!commentPanelIsDirty || isSaving"`) stays disabled.

**Defect 2 — saveComment payload drops step_results** (`TestRunExecutionView.vue:341-396`):
`saveComment()` builds a payload with `test_case_id`, `status`, `comment`, `defects` — and nothing else. Even if the user somehow triggered the save (e.g. by also editing the comment), the step statuses they clicked are silently discarded on the wire.

Root cause: when the step picker was added, only the full submit path was updated. The comment-panel save path is a leftover from before per-step status existed and was never retrofitted.

Related plans:
- api-testoria plan-026/031 — per-step status, backend
- plan-041 (if it exists — the frontend companion that added `StepStatusPicker`; verify during implementation)

---

## Scope

### In scope
- Extend `commentPanelIsDirty` to include step-result draft comparison against the loaded result
- Include `step_results` (from `testResultsStore.stepResultsDraft`) in the `saveComment()` payload, matching the shape the full `submitResult()` path already uses
- Preserve existing normalisation: send `step_results` only when the draft is non-empty, per the contract in `submitResult()`
- Unit test covering: (a) changing only a step status flips `commentPanelIsDirty` to true, (b) the save payload sent to the store action includes `step_results`
- Light manual regression check that the full submit flow still works (it already handles step_results; should be unaffected)

### Out of scope
- Any refactor that unifies `saveComment()` and `submitResult()` into a shared helper — tempting, but larger than this fix; tracked as tech debt
- UI changes to the step picker itself
- Backend changes (API side is already correct)
- E2E test for per-step persistence — add if the unit test gap justifies it, otherwise defer

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/test-runs/TestRunExecutionView.vue` | (1) Extend `commentPanelIsDirty` computed to also return `true` when `stepResultsDraft[caseId]` differs from `existingResult.step_results`. (2) Build `step_results` from the draft in `saveComment()` and include it in the payload when non-empty. |
| tests | `src/views/test-runs/__tests__/TestRunExecutionView.spec.ts` (existing or new) | Assert: changing a step status flips the dirty computed; `saveComment` passes `step_results` to the store action. |

### Key decisions

- **Compare draft vs. loaded result by value, not by identity.** Any array-equality check must compare `{ index, status, comment }` triples — the order from the backend may or may not match draft order, so normalise both sides (sort by `index`) before comparison. Keep the helper local; don't export unless a second caller appears.
- **Payload parity with `submitResult()`.** Use the same pattern: `step_results: stepDraft.length > 0 ? stepDraft : undefined`. This keeps the two paths consistent and avoids sending an empty array when nothing was touched.
- **Don't touch the store's draft structure.** The store correctly maintains drafts per case (`stepResultsDraft: Record<caseId, StepResult[]>`); the bug is purely in the view's read paths (dirty check + payload build).
- **No new "hasStepChanges" flag as public state.** Keep the dirty check a derived computed; a flag would drift from the draft over time.

---

## Tasks

### Implementation
- [ ] Add a private helper `stepDraftDiffersFromResult(caseId, existingResult)` inside `TestRunExecutionView.vue` that normalises both sides (sort by `index`, coerce comments to `""`) and compares
- [ ] Extend `commentPanelIsDirty` to OR in the step-draft comparison
- [ ] In `saveComment()`, read `testResultsStore.getStepResultsDraftForCase(caseId)` and include it in the payload when non-empty, mirroring the pattern from `submitResult()`
- [ ] Add/extend unit test: dirty flag flips on step status change; `saveComment` payload includes `step_results`
- [ ] Manual smoke on dev server:
  - [ ] Open a running test case, click a step status → Save button enables
  - [ ] Click Save → reload the case → step status persists
  - [ ] Edit only a comment (no step change) → still works as before
  - [ ] Full submit (select overall status + submit) → still sends step_results as before

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if the execution/per-step feature doc described this path, note that the partial-save path now persists step statuses too
- [ ] `docs/08-decisions/changelog.md` — one-line entry: saveComment now persists per-step statuses; dirty check includes step draft
- [ ] `docs/04-execution/tech-debt.md` — add "unify saveComment and submitResult payload builders" as new debt (low priority)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Dirty-check comparison triggers false positives when the backend returns step_results in a different order than the draft | Medium | Sort both sides by `index` before comparing; normalise nullable comment to `""` |
| Sending a `step_results` payload from saveComment when the user only edited a comment causes extra backend work | Low | Only include the key when the draft has entries; matches existing `submitResult` behaviour and the backend's `None`-as-no-op semantics |
| Someone reads the two similar payload builders and refactors them without catching a subtle difference | Low | Flag the duplication in tech-debt; leave a `// TODO: unify with submitResult payload` comment only if it adds clarity (otherwise skip, per comment guidance) |
| `stepResultsDraft` for a case was never hydrated (edge case: open case, never click) → draft is empty and compares equal to `existingResult.step_results` when existing is also empty | Low | Correct behaviour: nothing to save. No change needed. |

---

## Definition of done

- [ ] Clicking any step status on an open test case enables the Save button
- [ ] Clicking Save persists the new step status through `PUT /test-results/{id}` — verified by reloading the case and seeing the picker reflect the saved value
- [ ] Editing only the comment still works as before (no regression)
- [ ] Full "submit result" flow still works as before (no regression)
- [ ] Unit test covers both the dirty flag and the payload shape
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
