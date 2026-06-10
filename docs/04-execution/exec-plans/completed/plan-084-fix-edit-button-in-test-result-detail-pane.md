# Execution Plan: Fix Edit Button in Test Result Detail Pane (TES-79)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

The **Edit** button in the test case detail pane (right pane on a Test Run) opens the test case edit form (`/test-cases/:id/edit`) instead of redirecting to the in-run execution view ("Test cases list"). The **Execute** button in the same pane keeps its current behaviour (open the execution view focused on that case).

Linear: [TES-79](https://linear.app/testoria/issue/TES-79/edit-button-in-test-case-detail-pane-redirects-to-test-cases-list) — Bug, High.

---

## Context

In a Test Run, clicking a row opens a right pane (`src/components/test-runs/TestResultDetail.vue`) that has two buttons that both currently emit the same `edit` event:

1. Header **Edit** button (line 377–383) — intent: modify the underlying test case (steps, title, priority).
2. Not-yet-run panel **Execute** button (line 428–433) — intent: jump to the run execution view to record a result for this case.

The parent `src/views/test-runs/TestRunDetailView.vue` listens with one handler `handleEditResult` (line 189–194) that always routes to `/test-runs/:id/execute?testCaseId=...`. So:

- Header **Edit** → wrong destination (the bug).
- Panel **Execute** → correct destination by accident.

The correct edit destination already exists and is used by the standalone Test Case detail view (`src/views/test-cases/TestCaseDetailView.vue:92`): `router.push(\`/test-cases/${testCaseId}/edit\`)`. The route is defined in `src/router/index.ts:54-58` as `name: "TestCaseEdit"` with `meta: { requiresAuth: true, minRole: "lead" as UserRole }`.

The fix is to split the single `edit` event into two distinct intents (`edit-test-case` and `execute-result`) and route each correctly. Because the edit route requires `lead`, the header **Edit** button must also be role-gated (matching `TestCaseDetailView.vue:89`'s `v-if="authStore.isProjectManager"`) so a Tester role doesn't click it and bounce off the route guard.

No backend change is required — `PUT /test-cases/{id}` and the Test Case Editor view already exist.

---

## Scope

### In scope

- Split the single `edit` event in `TestResultDetail.vue` into two distinct events:
  - `edit-test-case` — emitted by the header pencil **Edit** button.
  - `execute-result` — emitted by the not-yet-run panel **Execute** button.
- Role-gate the header **Edit** button with `v-if="authStore.isProjectManager"` so it only appears for users who can actually open the editor (matches `TestCaseDetailView.vue:89` and the route guard `minRole: "lead"`).
- Update `TestRunDetailView.vue`:
  - New handler `handleEditTestCase(result)` → `router.push({ name: "TestCaseEdit", params: { id: result.test_case_id } })` (use named-route push, not a string template, to make the dependency explicit).
  - Rename the existing `handleEditResult(result)` → `handleExecuteResult(result)`. Body unchanged: `router.push(\`/test-runs/${testRunId}/execute?testCaseId=${result.test_case_id}\`)`.
  - Wire the two new events to the two handlers in the template.
- Unit test (`tests/unit/components/test-runs/TestResultDetail.spec.ts` — create if missing): assert clicking the header **Edit** button emits `edit-test-case` with the result payload, and the **Execute** button emits `execute-result`. Skip rendering when the user role lacks lead permissions.
- Add a Playwright case to `tests/e2e/test-runs.spec.ts` (or a new `tests/e2e/test-result-detail.spec.ts`):
  - Open a Test Run as a lead-or-higher user, click a result row, click the header **Edit** button, assert URL ends with `/test-cases/<id>/edit` and the editor view renders.
  - Same flow as a Tester role: assert the header **Edit** button is not present.
  - Optional: open a not-yet-run case, click **Execute**, assert URL contains `/test-runs/<id>/execute?testCaseId=<id>`.

### Out of scope

- Redesigning the right pane or the editor view itself.
- "Edit result" (changing status/comment/duration) inline in the pane — that already works via the existing comment edit / status update flow on the same component; this plan only fixes the button that is supposed to open the test-case editor.
- Returning the user back to the test run after they save the edit. The current standalone editor flow (`TestCaseDetailView` → `TestCaseEditView` → save → back to `TestCaseDetailView`) is the established UX; matching it from the test run pane is a separate enhancement plan if desired.
- Backend changes — `PUT /test-cases/{id}` and the editor route already exist; no api-testoria plan is needed.
- Renaming the `/test-runs/:id/execute` view or removing the `?testCaseId` query parameter contract.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/test-runs/TestResultDetail.vue` | Split `emit('edit', result)` into `emit('edit-test-case', result)` (header button, role-gated) and `emit('execute-result', result)` (Execute button in not-yet-run panel). Update `defineEmits<{ ... }>` typing. Add `v-if="authStore.isProjectManager"` on the header Edit button (import `useAuthStore` if not already imported) |
| view | `src/views/test-runs/TestRunDetailView.vue` | Replace `handleEditResult` with two handlers: `handleEditTestCase` (named-route push to `TestCaseEdit`) and `handleExecuteResult` (existing execute path). Wire `@edit-test-case="handleEditTestCase"` and `@execute-result="handleExecuteResult"` on `<TestResultDetail>` |
| tests | `tests/unit/components/test-runs/TestResultDetail.spec.ts` | New (or augment if exists) — emit assertions for both buttons, role-gating assertion |
| tests | `tests/e2e/test-runs.spec.ts` (or new `tests/e2e/test-result-detail.spec.ts`) | Lead-role: Edit → editor route. Tester-role: Edit button absent. Optional Execute happy path |
| docs | `docs/01-product/features/<test-runs feature file>.md` | Note that the right-pane Edit button opens the test case editor (lead+); Execute opens the in-run execution view |

### Key decisions

- **Split into two events, not one event with a payload discriminator.** Two semantic actions (modify the test case vs record a result) are distinct user intents. Distinct events make the parent's wiring obviously correct and let TypeScript catch a missing handler. The alternative — one `edit` event with `{ intent: 'edit' | 'execute' }` — couples the two intents and makes future divergence (e.g. one of them needing extra payload) harder.
- **Use named-route push for the editor.** `router.push({ name: "TestCaseEdit", params: { id: result.test_case_id } })` makes the dependency on the route name explicit so a future route rename is caught at type-check time (the standalone `TestCaseDetailView.vue:92` uses a string template — converting that too is out of scope but worth noting for a follow-up cleanup).
- **Role-gate the header Edit button.** The route already requires `minRole: "lead"`, so showing the button to a Tester would always result in a guard bounce. Gate matches `TestCaseDetailView.vue:89` (`v-if="authStore.isProjectManager"`). The pencil button disappearing is consistent with how Edit is gated everywhere else in the app.
- **Keep the Execute button label and path unchanged.** It is the only working flow in this pane today; renaming the event without renaming the URL or button label is a localised, low-risk change.
- **No back-redirect after save.** The editor's existing post-save behaviour (return to the test case detail view) is the established UX. Adding a "return to run" round-trip would require tracking `from` state in the router; deferred unless QA requests it.

---

## Tasks

### Implementation
- [x] In `src/components/test-runs/TestResultDetail.vue`:
  - [x] Update `defineEmits` to declare `edit-test-case` and `execute-result` (drop `edit`)
  - [x] Rename `handleEdit` → `handleEditTestCase` (emits `edit-test-case`); add `handleExecuteResult` (emits `execute-result`)
  - [x] Header **Edit** button: `@click="handleEditTestCase"`, add `v-if="authStore.isProjectManager"`
  - [x] Not-yet-run panel **Execute** button: `@click="handleExecuteResult"`
  - [x] Import `useAuthStore` if not already in scope
- [x] In `src/views/test-runs/TestRunDetailView.vue`:
  - [x] Add `function handleEditTestCase(result: TestResult)` → `router.push({ name: "TestCaseEdit", params: { id: result.test_case_id } })`
  - [x] Rename `handleEditResult` → `handleExecuteResult` (body unchanged)
  - [x] Update `<TestResultDetail>` listeners: `@edit-test-case="handleEditTestCase"`, `@execute-result="handleExecuteResult"`
- [x] Add unit tests in `tests/unit/components/test-runs/TestResultDetail.spec.ts`
- [x] Add Playwright coverage for both lead-role and tester-role flows

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `npm run test:e2e -- test-runs.spec.ts` (or new spec) passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/<test-runs feature file>.md` — note the right-pane Edit (lead+) → test case editor; Execute → in-run execution view
- [x] `docs/06-generated/routes-map.md` — no change expected (no route added/removed); read once to confirm
- [x] `docs/08-decisions/changelog.md` — plan-084 entry: split single `edit` event into `edit-test-case` and `execute-result` to fix TES-79
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A consumer of `TestResultDetail` other than `TestRunDetailView` still listens to the now-removed `edit` event | Low | `grep -rn "TestResultDetail" src/` before merging — there is currently only one consumer, but verify |
| Tester-role users lose access to the in-pane Edit button and complain it disappeared | Low | They never had a working Edit button (route would bounce). The Execute button stays visible for not-yet-run cases. Document in PR description |
| Named-route push breaks if `TestCaseEdit` route is renamed later without updating this call site | Low | TypeScript catches it via the router's named-route typing if the project uses typed routes; otherwise grep is enough |
| Playwright e2e flake when waiting for the editor view to render | Medium | Wait on a stable selector in the editor (e.g., the form's title input `data-testid="test-case-editor-title"` if present, otherwise the route URL) rather than time-based waits |
| The header Edit button being role-gated changes a snapshot test that asserted its presence | Low | Update the snapshot; document in PR. Snapshot change reflects intent |

---

## Definition of done

- [x] In a Test Run's right pane, clicking the header **Edit** button opens `/test-cases/<id>/edit` (the test case editor) for lead-and-above users
- [x] The header **Edit** button is hidden for Tester / Read-Only roles
- [x] The not-yet-run panel **Execute** button still opens `/test-runs/<id>/execute?testCaseId=<id>`
- [x] Unit test asserts both events emit with the correct payload
- [x] Playwright e2e covers the lead-role Edit happy path and the tester-role gating
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] PR checklist completed; feature doc updated; changelog entry added
- [x] TES-79 marked Done in Linear with the merge commit linked
