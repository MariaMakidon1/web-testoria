# Execution Plan: Detail View — Persist Comment Edits from Results & Comments Panel

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs/:id`, when a user selects a test case, edits the comment in the **Results & Comments** panel and clicks Save, actually persist the change through the API — today the click emits an event that nothing listens to, yet a misleading "Comment saved" toast fires.

---

## Context

The detail view embeds `TestResultDetail.vue` inside a `SplitterPanel` so users can read, select and edit results inline without navigating to the execution view. The component supports an inline comment editor with image attachments and emits `"update-comment"` on save.

**Bug location** (two cooperating defects):

1. **`TestResultDetail.vue:178-183`** — the `saveComment()` function emits `update-comment` with `{ comment, images }`. No local save call is made; persistence is the parent's responsibility.

2. **`TestRunDetailView.vue:298-308`** — the parent mounts `<TestResultDetail>` with only `@close="handleCloseDetail"` and `@edit="handleEditResult"`. There is no `@update-comment` handler, so the emitted event is dropped on the floor.

3. **`TestResultDetail.vue:186-187`** — immediately after emitting, the component calls `toast.add({ summary: "Comment saved", detail: "Your comment has been updated" })` unconditionally. The user sees a success toast for an operation that never happened.

Combined, editing a comment from the detail panel silently loses the edit while showing a success message — the worst-case UX failure mode.

The execution view (`TestRunExecutionView.vue`) handles comment persistence via its own `saveComment()` that calls `testResultsStore.submitResult()` or `updateTestResult()` — that path is unaffected and keeps working. The fix here is confined to the detail view and the shared detail component.

Related:
- plan-068 (in flight) — unifies detail/execution views via grouped `GET /test-runs/{id}/cases` endpoint
- plan-067 / plan-069 — edit run metadata + run cases from detail page (2026-04-20)

---

## Scope

### In scope
- Add an `@update-comment` handler on the `<TestResultDetail>` usages in `TestRunDetailView.vue` that calls `testResultsStore.updateTestResult(resultId, { comment, images? })` and refreshes the result list entry
- Move the success toast out of `TestResultDetail.saveComment()` so it only fires after the API call resolves (the parent is the right place — it owns the async outcome)
- Surface API errors to the user with a toast on failure; keep the panel in edit mode so the user can retry
- Handle the image-upload path: if attachments were added, upload them first and include attachment references before sending the comment update (mirror the execution view's order of operations)
- Unit test the detail view's `@update-comment` handler: happy path and error path

### Out of scope
- Refactoring `TestResultDetail` into a "smart" component that owns its own save — kept as a dumb, emit-only component to preserve reuse options
- Extracting a shared save helper between execution and detail views — tracked as tech debt (overlaps with plan-068's unification work)
- Rich text / formatting changes to the comment field
- Backend changes (endpoint already accepts comment + attachments on `PUT /test-results/{id}`)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/test-runs/TestResultDetail.vue` | Remove the unconditional success toast from `saveComment()`. Keep the emit. Optionally add an `is-saving` prop so the parent can disable the Save button during the round trip. |
| view | `src/views/test-runs/TestRunDetailView.vue` | Add `handleUpdateComment(payload)` function and wire `@update-comment="handleUpdateComment"` on both `<TestResultDetail>` usage (the Splitter path at line 298 — second mount was removed in an earlier refactor, verify during implementation). The handler: (1) uploads any new images via the existing attachments flow; (2) calls `testResultsStore.updateTestResult(selectedResult.id, { comment, ... })`; (3) refreshes the result in `testResultsStore.results` (the store action should already do this); (4) toasts success on resolve / error on reject. |
| store | `src/stores/testResults.ts` | Verify `updateTestResult(id, payload)` already returns a promise that resolves to the updated result and that the action updates the `results` array in-place. If it only updates `currentResult` or similar, extend it minimally. No behaviour change beyond what's needed. |
| tests | `src/views/test-runs/__tests__/TestRunDetailView.spec.ts` | Mount the view, trigger `update-comment` on the `TestResultDetail` stub, assert `updateTestResult` was called with the expected payload; assert error toast on reject. |
| tests | `src/components/test-runs/__tests__/TestResultDetail.spec.ts` | Existing: assert toast is no longer fired inside `saveComment()` — only the emit happens. |

### Key decisions

- **Parent owns persistence.** `TestResultDetail` is used in multiple contexts (detail panel, potentially a future modal); centralising persistence on the view keeps the component presentational. This matches the frontend invariant "no component imports from `src/api/`".
- **Success toast moves to the parent, not to the store.** The store action returns a promise; the view decides whether to toast. Stores shouldn't own user-facing messaging (keeps stores free of UI concerns per `ARCHITECTURE.md` invariants).
- **Keep the component emit contract unchanged** (`update-comment` with `{ comment, images }`). Renaming to `save` would be cleaner but breaks nothing and isn't worth the churn.
- **Fail loudly but keep the edit alive.** On error, don't drop the user's typed comment or dismiss the edit panel — otherwise a network blip destroys their work. Toast the error, leave `isEditingComment = true`.
- **Optimistic UI: no.** Comment edits are infrequent and the response is fast; optimistic update adds a reconciliation path for little gain.

---

## Tasks

### Implementation
- [ ] Remove the unconditional `toast.add` from `TestResultDetail.saveComment()`; keep the emit
- [ ] Add `handleUpdateComment({ comment, images })` in `TestRunDetailView.vue`
  - [ ] Upload new images via the attachments API (reuse existing helper if present; otherwise inline the store call)
  - [ ] Call `testResultsStore.updateTestResult(selectedResult.id, { comment, ... })`
  - [ ] Toast success on resolve; toast error on reject
  - [ ] On reject, keep the detail panel in edit mode
- [ ] Wire `@update-comment="handleUpdateComment"` on `<TestResultDetail>` at line 298
- [ ] Verify `testResultsStore.updateTestResult` updates the `results` array in-place (extend if needed)
- [ ] Unit test: `TestRunDetailView` wires the handler; `updateTestResult` called with correct payload
- [ ] Unit test: `TestResultDetail` no longer toasts inside `saveComment()`
- [ ] Manual smoke on dev server:
  - [ ] Open a run, click a case, edit the comment, click Save → network tab shows `PUT /test-results/{id}`, list shows updated comment
  - [ ] Add an image, save → attachment uploads + comment updates
  - [ ] Simulate offline → error toast, panel stays in edit mode, typed comment preserved

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if the detail-view feature doc mentions comment editing, remove "read-only" / "not yet persisted" claims if any
- [ ] `docs/08-decisions/changelog.md` — short entry: detail view persists comment edits via `updateTestResult`; toast moved to parent
- [ ] `docs/04-execution/tech-debt.md` — add "unify comment-save flow between detail and execution views" as new debt (supersedes on plan-068's roadmap)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Image upload partial success — images uploaded but comment update fails | Low | Order the calls: images first, then comment. On comment failure, attachments are already persisted server-side; leave a tech-debt note about orphan cleanup rather than introducing a rollback path |
| Another parent of `TestResultDetail` exists that now needs the handler too | Low | A grep confirms the detail view is the only mount; verify again during implementation |
| Removing the in-component toast surprises other consumers that relied on the implicit success feedback | Very low | No other consumer exists today; the toast was always misleading (fired on a non-save) |
| `updateTestResult` doesn't update the `results` array in-place and the list stays stale | Medium | Verify up front; if the action only updates a different slot, extend it minimally or re-fetch the list after save |

---

## Definition of done

- [ ] Editing a comment from the detail panel on `/test-runs/:id` issues `PUT /test-results/{id}` with the new comment (confirmed via network tab)
- [ ] Success toast fires only after the API call resolves
- [ ] Error toast fires on failure; edit panel stays open with the user's typed comment intact
- [ ] Image attachments added in the edit panel upload as part of the save and appear on the saved result
- [ ] No regression on the execution view's separate save flow
- [ ] Unit tests cover handler wiring (happy + error path) and the removed in-component toast
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
