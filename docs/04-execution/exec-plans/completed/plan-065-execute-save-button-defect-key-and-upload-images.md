# Execution Plan: Fix Save button on `/test-runs/:id/execute` — enable on Defect Key change and actually upload images

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

Two linked defects on the execution page's "Comment & Attachments" block:

1. **Save button stays disabled when only the Defect Key changes.** A user typing a Jira key without touching the comment or adding an image can't save it. Enable Save whenever any of the three inputs (comment, images, defect key) has changed from the persisted state.

2. **Pasted / dragged images never reach the server.** `saveComment()` sends the comment + defects via `submitResult`, but never calls `uploadAttachment(...)` for the pending images. The backend attachment endpoint exists; the execution view simply isn't wired to it. Fix: after the comment/result save succeeds, upload each new image (and delete any removed-existing ones).

---

## Context

### No backend change required

The attachment API is already in place:

- `POST /test-results/{result_id}/attachments` — multipart upload, returns a `ResultAttachmentResponse` (`api-testoria: app/api/v1/test_results.py:86-105`)
- `DELETE /test-results/{result_id}/attachments/{attach_id}` — remove

The web client already wraps both:

```ts
// src/api/testResults.ts:49-70
export async function uploadAttachment(resultId, file) { … }
export async function deleteAttachment(resultId, attachmentId) { … }
```

And the store re-exports them:

```ts
// src/stores/testResults.ts:128-136
async function uploadAttachment(resultId, file) { … }
async function deleteAttachment(resultId, attachmentId) { … }
```

The only thing missing is the call site in `TestRunExecutionView.vue`.

### Bug 1 — Save button gating

```vue
<!-- TestRunExecutionView.vue:857-860 -->
<Button
  label="Save"
  :loading="isSaving"
  :disabled="!currentComment && currentImages.length === 0"
  @click="saveComment"
/>
```

The disabled expression ignores `currentDefectKey`. A user loading a case with `currentComment === ""` and `currentImages === []` but typing a key cannot save — the button stays greyed out. The existing payload path (`saveComment → submitResult`) already sends `defects`; it's only the UI gate that's wrong.

### Bug 2 — images not uploaded

`saveComment()` (lines 205-247):

```ts
await testResultsStore.submitResult(testRunId, {
  test_case_id: selectedTestCase.value.id,
  status: currentStatus,
  comment: currentComment.value || undefined,
  defects: currentDefectKey.value ? [{ tracker: "jira", key: currentDefectKey.value }]
                                  : existingResult?.defects || undefined,
});
// ← no image upload
```

And the mount hook (lines 178-199) loads existing attachments into `currentImages` with `isExisting: true`. The user can drag/paste new ones (`isExisting: false`) and remove existing ones — but the removal and the new upload are both local-only. `submitResult` creates / updates the `TestResult`, returns an `id`, and then the view does nothing with the images.

So the intent of the code is clear — there's even a "Save hint" block tied to `currentImages.some((img) => !img.isExisting)` at line 863 — the upload step was just never implemented.

### Order of operations matters

- For a case with **no prior result**, the attachment upload can only happen after `submitResult` returns the created result's `id` — there's nothing to attach to yet.
- For a case with an **existing result**, we already have `existingResult.id` before Save is clicked.

Both paths therefore share the same sequencing: submit first, then diff attachments.

### Save button semantics

Today, three things happen when Save is clicked:

- Comment persisted
- Defects persisted
- Images (intended to be) persisted

With bug 2 fixed, all three land. Bug 1 is the enable-gate to make the button actually reachable.

---

## Scope

### In scope (page `/test-runs/:id/execute`, file: `TestRunExecutionView.vue`)

- **Save button enable logic**: Introduce a `commentPanelIsDirty` computed that returns `true` if any of:
  - `currentComment` differs from the persisted result's `comment` (treat `""` and `null` as equal)
  - `currentDefectKey` differs from the persisted result's first defect `key` (treat `""` and missing as equal)
  - `currentImages` differs from the persisted result's attachments (any new non-`isExisting` image, or any existing image removed from the list)
  - Gate the Save button's `:disabled` on `!commentPanelIsDirty || isSaving`
- **Actually upload images on save**: Rewrite `saveComment()` so that after `submitResult` returns the result:
  - For each `currentImages[i]` with `!isExisting` and a `file` / blob, call `testResultsStore.uploadAttachment(resultId, file)`
  - For each attachment present in `existingResult.attachments` but **not** in `currentImages` (user removed it from the preview list), call `testResultsStore.deleteAttachment(resultId, attachmentId)`
  - Refresh the result (`fetchResults` / `getResultByTestCaseId` → reconcile attachments) so `isExisting` flags update for the newly-uploaded images
  - Toast summary reflects what actually happened ("Comment + N attachments saved")
- **Failure handling**: if `submitResult` fails, no uploads run; toast the error. If an individual upload fails, surface a partial-success toast ("Comment saved; 2 of 3 images uploaded — check network") and keep the failed images in the preview so the user can retry
- **Pending-upload hint**: the existing `save-hint` block (line 863) that checks `currentImages.some((img) => !img.isExisting)` keeps working; clarify the copy to "Unsaved images — click Save to upload"
- **Empty save guard**: when nothing has changed (`!commentPanelIsDirty`), the button stays disabled; `saveComment` is never called
- **Keep the `submitResult` (Pass/Fail/Block) flow orthogonal**: those buttons already submit comment + defects; extend them the same way with the image upload step, so a user who pastes an image and clicks "Passed" still gets the image saved
- Unit tests for the dirty-state computed (every combination: comment only / defect only / image only / existing-removed / clean)
- Unit tests for `saveComment`: new image uploaded; removed existing deleted; partial failure reported
- E2E: open a case without a prior result, type a defect key only → Save enabled → click → page reload shows the key persisted; paste an image → Save enabled → click → reload shows the attachment; delete an existing attachment → Save → reload confirms deletion

### Out of scope

- Embedding images inline in the comment text (rich-text comment) — logged as follow-up; current UX is "comment + separate attachments"
- A new backend endpoint for atomic "save comment + attachments" in one request — logged; two-phase save (result first, then attachments) is fine for v1
- Optimistic UI for image uploads — today images appear in the preview the moment they're pasted; they stay there through the save round-trip; a failed upload is surfaced via toast
- Drag-and-drop reordering of images
- Image compression on the client before upload
- Changing the attachment component on `/test-runs/:id` (read-only in that panel)
- Changes to the `defects` payload shape beyond what's already sent
- Moving beyond a single defect key (the UI currently captures one key; a "multi-defect" editor is a separate UX plan — aligned with plan-064's linking flow on the detail page)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-runs/TestRunExecutionView.vue` | `commentPanelIsDirty` computed; Save button disabled gate; `saveComment` does result-save then attachment diff (upload new + delete removed); `submitResult` (Pass/Fail/Block) also runs the attachment diff |
| utils | `src/views/test-runs/TestRunExecutionView.vue` (local helper or new file under `src/utils/`) | `diffImages(current: UploadedImage[], existing: Attachment[]) -> { toUpload: File[], toDelete: number[] }` — pure function, unit-testable |
| api / store | **no change** — `testResultsStore.uploadAttachment` / `deleteAttachment` / `submitResult` are already in place |
| tests | `tests/unit/views/TestRunExecutionView.spec.ts` (new or extended) | Dirty state + save-flow |
| tests | `tests/unit/utils/diffImages.spec.ts` (if extracted) | Pure diff cases |
| e2e | `tests/e2e/test-run-execute.spec.ts` | Defect-only save; image upload; image delete |

### Key decisions

- **Dirty-state computed, not naive "disabled unless fields non-empty".** The current gate is a proxy for "user has something to save", but it gets the defect-only case wrong. Comparing against the persisted result is the correct check and also prevents a no-op save when nothing has changed.
- **Treat `""`, `null`, and `undefined` as equivalent in the dirty check.** Otherwise the button flickers on/off as the text area is blurred and the stored value is `null`.
- **Two-phase save (result then attachments).** Keeps today's two endpoints unchanged. An atomic single-request alternative would need a new multipart endpoint (logged). Two phases means a partial-success window, which is manageable via a clear toast.
- **Attachment diff is pure and unit-testable.** Extract `diffImages` so the logic ("which images are new" vs "which existing ones were removed") isn't entangled with the view's async plumbing.
- **Refresh the result after save.** The server assigns attachment ids; the local `currentImages` needs to reflect them so subsequent saves don't attempt to re-upload. Re-hydrate from `getResultByTestCaseId` post-save.
- **Partial-failure telemetry via toast, not silent success.** If 2 of 3 uploads fail, the user should see it and be able to retry. The failed images stay in the preview with `!isExisting`; clicking Save again retries just those.
- **Pass/Fail/Block path gets the same attachment diff.** Otherwise pasting an image and clicking "Passed" without clicking Save first would lose the image — a footgun that's exactly what bug 2 describes.
- **No new "defect objects" multi-row UX.** The current input captures one key and maps it to a `jira` tracker; a richer editor is a separate plan (overlaps with plan-064's linking UX on the detail page).

---

## Tasks

### Implementation
- [ ] Extract `diffImages(current, existing)` helper:
  - [ ] `toUpload`: every `current[i]` with `!isExisting` and a truthy `file` / `blob`
  - [ ] `toDelete`: every `existing[j].id` missing from `current` (the user removed it)
  - [ ] Stable across reorderings; unit-test edge cases (empty / all-new / all-existing / mixed)
- [ ] Add `commentPanelIsDirty` computed:
  - [ ] Read the persisted result via `getResultByTestCaseId(selectedTestCase.value?.id)`
  - [ ] Compare normalised `comment` (`"" ≡ null ≡ undefined`)
  - [ ] Compare normalised `currentDefectKey` against the first defect's `key` (or `""` if no defects)
  - [ ] Compare `diffImages(currentImages, existing.attachments)` — dirty if either list is non-empty
- [ ] Update Save button: `:disabled="!commentPanelIsDirty || isSaving"`
- [ ] Rewrite `saveComment()`:
  - [ ] `submitResult` with comment + defects (as today)
  - [ ] Resolve `resultId` from the returned / refreshed result
  - [ ] Diff attachments; upload new files; delete removed ones (parallel `Promise.allSettled`)
  - [ ] Collect failures; if any, toast a partial-success message; otherwise toast "Saved"
  - [ ] Refresh the result state so `currentImages` rehydrates with backend-assigned ids and `isExisting: true`
- [ ] Extend `submitResult(status)` (Pass/Fail/Block) with the same attachment-diff step
- [ ] Pending-upload hint copy: clarify "Unsaved images — click Save to upload"
- [ ] Defensive: synthetic `no_run` rows (plan 055) never reach this view; skip the upload step if `resultId == null`
- [ ] Unit tests:
  - [ ] `diffImages`: empty/empty → no ops; new-only → upload; existing-only-removed → delete; mixed → both
  - [ ] `commentPanelIsDirty`: defect-only change → true; comment-only → true; image-add → true; image-remove → true; clean → false; `"" vs null` comment → false
  - [ ] `saveComment` success: uploads called with the right files; no deletes when nothing removed
  - [ ] `saveComment` with removed existing image: delete called with the attachment id
  - [ ] `saveComment` upload failure: toast says partial; failed image stays in `currentImages`
  - [ ] `saveComment` with only defect-key change: no uploads / deletes; PATCH still fires
  - [ ] `submitResult(status)` carries the same attachment diff step
- [ ] E2E:
  - [ ] Open a case with no prior result; type a Jira key; Save → enabled → click → reload shows key persisted
  - [ ] Open a case; paste an image; Save → reload shows the attachment
  - [ ] Remove an existing attachment via its × button; Save → reload confirms deletion
  - [ ] Paste two images, click "Passed" → both images persist on reload
  - [ ] Simulated upload failure (devtools network throttle / offline) → partial-success toast; retry succeeds
- [ ] Manual: dark-mode rendering of the preview + dirty-state button; large-image performance

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/006-test-execution.md` — update to note that the execution page's "Comment & Attachments" panel persists all three (comment, defect key, attachments) on Save
- [ ] `docs/02-architecture/frontend/state-management.md` — document the two-phase save (result first, attachments second) as the canonical pattern here
- [ ] `docs/08-decisions/changelog.md` — record: (a) Save button now enabled on defect-key change; (b) execution page actually uploads pasted / dragged images
- [ ] `docs/04-execution/tech-debt.md` — log follow-ups: (a) atomic single-request save endpoint (result + attachments) if partial-success UX becomes a complaint, (b) inline-image comments (rich-text), (c) multi-defect editor aligned with plan-064's linking flow
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Two-phase save races: result saved, page closed before attachments upload, losing the attachments | Medium | Show a blocking spinner during the full save; a beforeunload guard when `isSaving` is true; logged in tech debt for an atomic endpoint |
| Large images stall the save UI | Medium | Existing behaviour (no server-side compression); parallel uploads with `Promise.allSettled`; progress indicator could be added later |
| Removing an existing attachment then cancelling the save intent leaves the local state out of sync | Low | `commentPanelIsDirty` drives the Save state; if the user navigates away without saving, a "you have unsaved changes" prompt is a nice-to-have (logged); today's behaviour already has this risk for comment/defect |
| Partial-failure UX confuses users into thinking a full save happened | Low | Explicit toast: "Comment saved; 2 of 3 images uploaded"; failed images remain in the preview |
| `defects` payload overwrites defects linked on the detail page (plan-064) because only the first defect is tracked in `currentDefectKey` | Medium | Same behaviour as today; users on the execute page see / edit only one defect key; aligning the flows is a future plan (noted) |
| Synthetic `no_run` rows (plan 055) somehow reach the save path and crash on `uploadAttachment(null, …)` | Low | Guard on `resultId == null`; unit test |
| Save button now enables more often and a user double-saves an unchanged payload | Low | `commentPanelIsDirty` flips back to `false` after a successful save (state reconciled) — button re-disables until a new change |
| E2E image-paste test is flaky across browsers | Medium | Use a drag-drop fixture instead of clipboard paste if paste is unreliable in the test runner |

---

## Definition of done

- [ ] Save button on `/test-runs/:id/execute` enables the moment any of (comment, defect key, images) differs from the persisted state; disables when fully clean
- [ ] Clicking Save uploads every new image and deletes every removed existing attachment, in addition to persisting comment + defects
- [ ] Clicking Pass/Fail/Block also persists any pending image changes (same diff step)
- [ ] Partial failures surface in a toast; the failing image stays in the preview for retry
- [ ] Post-save, `currentImages` reflects the server's attachment ids and `isExisting: true`
- [ ] No new backend endpoints introduced
- [ ] Unit tests cover `diffImages`, `commentPanelIsDirty`, and every saveComment outcome
- [ ] E2E covers defect-only save, image paste + save, image delete + save, and a submit-result path with pending images
- [ ] Dark-mode rendering verified
- [ ] Docs updated; follow-ups logged
- [ ] PR checklist completed
