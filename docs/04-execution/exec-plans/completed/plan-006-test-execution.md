# Execution Plan: 006 — Test Execution

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Surface the `message` and `stack_trace` fields in the execution UI for failed automated tests, add a `Retest` progress indicator clarification, and write unit tests for `testResultsStore`.

---

## Context

`TestResult` has `message` (error output) and `stack_trace` fields defined in the type but they are not rendered anywhere in the UI. For automated test integrations, these fields carry the most useful failure information. Additionally, the `Retest` status asymmetry (stored but excluded from progress calculation) needs to be communicated clearly to users in the UI — currently there is no tooltip or note explaining that `Retest` does not advance completion. Unit tests for `testResultsStore` are not yet written.

---

## Scope

### In scope
- Render `result.message` as a collapsible "Error output" section in `TestResultDetail` (when not null)
- Render `result.stack_trace` as a collapsible code block in `TestResultDetail` (when not null)
- Add tooltip on the progress bar explaining that `Retest` results do not count toward completion
- Unit tests for `testResultsStore` (submit, update, progress sync, status distribution)

### Out of scope
- Automated test result ingestion API (backend concern)
- Side-by-side diff view for `stack_trace` (deferred)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-runs/TestResultDetail.vue` | Add collapsible `message` and `stack_trace` panels; conditionally rendered when non-null |
| components | `src/components/test-runs/TestResultsList.vue` or execution view header | Add tooltip on progress bar re: `Retest` exclusion |
| tests | `tests/unit/stores/testResults.spec.ts` | New — submit, update, upsert behaviour, progress sync |

### Key decisions

- `message` and `stack_trace` fields are displayed read-only (not editable in the UI) — they are populated by automated test runners via the backend, not manual testers.
- `stack_trace` uses a `<pre>` block with horizontal scroll to preserve formatting without wrapping.
- Progress tooltip is a PrimeVue `v-tooltip` on the `ProgressBar` component — no new component needed.

---

## Tasks

### Implementation
- [ ] Add `message` collapsible section to `TestResultDetail`
- [ ] Add `stack_trace` collapsible code block to `TestResultDetail`
- [ ] Add `Retest` exclusion tooltip to progress bar
- [ ] Write `tests/unit/stores/testResults.spec.ts`

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/006-test-execution.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `stack_trace` content may contain sensitive paths or data | Low | Fields are already stored in the result; display responsibility is the user's. No sanitisation beyond XSS escaping needed. |

---

## Definition of done

- [ ] `message` and `stack_trace` render correctly when populated
- [ ] Fields are hidden when null (no empty sections)
- [ ] Progress bar tooltip explains `Retest` exclusion
- [ ] Unit tests for `testResultsStore` passing
