# Execution Plan: Ctrl+V pasted screenshots in result comments — parse all images, bulk-upload, render inline, embed in PDF/Excel exports

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/test-runs/:id` (detail view) and `/test-runs/:id/execute` (execute view), allow the user to paste (Ctrl+V) or drag **multiple** screenshots into the comment area, upload every one to the backend via a single bulk call, render them as a gallery under the comment on both views, and embed them in PDF / Excel report exports.

---

## Context

User report: _"in WEB I can Ctrl+V image/screenshot but is not saved"_.

What's there today:

- `ImageUploadArea.vue:130-173` handles paste, but only accepts the **first** image in `clipboardData.items` and stages it locally (`File` object held in component state). No HTTP call.
- `TestRunExecutionView.vue:518-522, 673-679` has its own global paste handler with the same single-item behaviour.
- `TestResultDetail.vue:268-304` mirrors the same pattern on the detail panel.
- `saveComment()` in the execute view (plan-065 follow-up) was meant to wire the upload but the single-file-per-request backend endpoint made it awkward and the work stalled.
- Fetched `attachments` on `TestResultResponse` have `id / filename / file_size / mime_type / uploaded_at` but **no URL** — even if we got files uploaded, there'd be nothing to render. The paired backend plan (api-042) adds `url` (presigned, short TTL) so this plan can finally close the loop.
- `usePdfExport.ts` (jsPDF + jspdf-autotable) and `useExcelExport.ts` (exceljs) skip `result.attachments` entirely — the exports drop screenshots on the floor.

What api-042 delivers that this plan consumes:

- `POST /test-results/{id}/attachments/bulk` — `files: list[UploadFile]`, up to 10 per request
- `ResultAttachmentResponse.url: string` — presigned GET URL, TTL 15 min on live responses, 7 days on report payloads
- MIME whitelist: `image/png`, `image/jpeg`, `image/webp`, `image/gif`; 10 MB per file

Related:

- Plan-065 (completed) — execute-view save-button + single-file upload wiring (superseded by this plan for paste; single-upload path remains for drag-drop into the dedicated dropzone on other panels)
- Plan-073 (completed) — detail-view comment save via `update-comment` parent-handler pattern
- Plan-062 (completed) — `v-html` + sanitisation for step HTML; same `v-html` policy applies to rendering comment text but images ride a separate gallery, not inline HTML
- Tech-debt: _"Status color duplication"_, _"Pass-rate formatting"_ — unrelated here
- Tech-debt candidate this plan adds: inline-image comment bodies (rich-text `<img>` inside comment text) — deferred

---

## Scope

### In scope

- `ImageUploadArea.vue`:
  - Rewrite `handlePaste` to iterate **all** `clipboardData.items` of type `image/*`, not just the first. Drag-and-drop handler symmetric (`event.dataTransfer.files` — already multi-file but verify).
  - De-duplicate within a paste batch by `(size, name, lastModified)` so a single Ctrl+V in a system that duplicates the clipboard buffer doesn't stage two copies.
  - Enforce the same client-side caps the backend enforces: max 10 pending files per save, max 10 MB per file, MIME whitelist. Surface a toast _"Ignored N file(s): unsupported type / too large"_ — partial-accept, not all-or-nothing.
  - Accept a `:max-files` and `:accept` prop so the component stays reusable for future "upload any file" contexts.
  - Emit `update:files` with the full deduped list; parent treats it as the staged set.
- `src/api/testResults.ts`:
  - New `uploadAttachmentsBulk(resultId, files: File[])` calling `POST /test-results/{id}/attachments/bulk` via `multipart/form-data` with `files[]`.
  - Keep existing single-file `uploadAttachment(resultId, file)` (used by other panels; no call-site churn).
  - Update `ResultAttachmentResponse` TS type to include `url: string`.
- `src/stores/testResults.ts`:
  - New action `uploadAttachmentsBulk(resultId, files)` that calls the API helper and merges the returned `ResultAttachment[]` into `results[].attachments` for the matching result id. Updates in-place to avoid a full re-fetch.
  - Keep the existing `uploadAttachment` / `deleteAttachment` actions.
- `TestRunExecutionView.vue`:
  - Replace the in-view global paste handler with `ImageUploadArea.vue`'s paste semantics (already a child component; remove the duplicate handler so paste works only when focus is inside the comment area or the staged-images panel — no more full-document capture).
  - `saveComment()` calls `uploadAttachmentsBulk` with every `currentImages[i]` where `!isExisting`, in a single request, after `submitResult` returns.
  - Remove the "loop over each pending image" path left over from plan-065.
  - Handle partial failures: the bulk response returns `{ uploaded: [...], failed: [{ filename, reason }] }`; surface failed ones in a toast, keep them in `currentImages` for retry.
- `TestResultDetail.vue` (detail panel):
  - Same rewrite: paste handler uses the shared `ImageUploadArea.vue`; `@update-comment` emission now includes a `files: File[]` list; the parent (`TestRunDetailView.vue`, per plan-073) routes it through `uploadAttachmentsBulk` then `updateTestResult`.
  - Remove the internal global paste handler; keep the listener scoped to the editing state via `ImageUploadArea`.
- Comment / attachment rendering:
  - New `ResultAttachmentGallery.vue` component. Props: `attachments: ResultAttachment[]`, `max-preview: number = 6`.
  - Thumbnails: `<img :src="attachment.url" />` at 120px fixed height. Click opens full-size in a PrimeVue `Galleria` lightbox.
  - Fallback when `url` is missing or returns 403 (TTL expired): show a "Reload images" button that re-fetches the result via `testResultsStore.fetchResults(runId)` to refresh URLs.
  - Empty state: component renders nothing when `attachments.length === 0` — never a stray border.
  - Used in `TestResultDetail.vue` (detail panel) and in `TestRunDetailView.vue` under each result row in the Results panel.
- PDF export (`usePdfExport.ts`):
  - For every result row, if `attachments.length > 0`, add a nested "Attachments" section: up to 3 thumbnails per result (matching backend cap). Images fetched via `fetch(attachment.url)` → `toDataURL` → `doc.addImage`.
  - Graceful degradation: if the fetch fails for any image, render a placeholder line _"[image unavailable — open in app]"_ with a hyperlink to `/test-runs/:id`.
  - Respect the same `REPORT_ATTACHMENT_MAX_PER_RESULT` cap from the backend payload; when backend sends the "report-TTL" presigned URL (7-day), prefer it over the live URL to avoid mid-export expiries.
- Excel export (`useExcelExport.ts`):
  - For every result row with attachments, add images to a new "Screenshots" column.
  - Use `exceljs`'s `workbook.addImage({ base64 })` + `worksheet.addImage(imageId, { tl, br })` to anchor into the row's cell.
  - Same 3-per-result cap; "+N more" text in the cell when overflow.
  - Row height auto-adjusted to fit one thumbnail (80px tall).
- Types (`src/types/testResult.ts`):
  - `ResultAttachment { id, filename, file_size, mime_type, uploaded_at, uploaded_by, url: string }`
  - New `BulkUploadResponse { uploaded: ResultAttachment[]; failed: Array<{ filename: string; reason: string }> }`
- Unit tests:
  - `ImageUploadArea.spec.ts`: paste with 3 images → emits 3; paste with 2 images + 1 non-image → emits 2 and toasts 1 ignored; over-cap rejects with toast; drag-drop 4 images symmetric; duplicate detection
  - `uploadAttachmentsBulk` store action: merges results into `results[id].attachments` without clobbering sibling results
  - `usePdfExport`: PDF payload includes image bytes when attachments present; gracefully handles 1 of 3 images failing to fetch
  - `useExcelExport`: image base64 present in the generated workbook binary
  - `ResultAttachmentGallery.spec.ts`: renders nothing with empty list; thumbnails clickable; reload-images button appears on 403-simulated URL
- E2E (Playwright):
  - On `/test-runs/:id/execute`, paste two images into the comment area → Save → reload → both thumbnails render in the detail panel
  - On `/test-runs/:id`, open a case, edit comment, paste 3 images, save → thumbnails appear under the result in the Results panel and in the detail panel
  - Generate a PDF report for a run with one result having 2 screenshots; open the downloaded PDF via a helper and assert image count
  - Partial failure: stub the bulk endpoint to return `failed: [{ filename: "bad.png" }]` for one of two files → the bad one stays in the preview; a toast surfaces the partial result

### Out of scope

- Inline `<img>` inside the comment _text_ (Tiptap with image extension in the comment field). Screenshots ride a separate "gallery" area under the comment text — kept simple for v1. Logged as follow-up.
- Image editing / annotation (arrows, redaction) — users paste what their OS screenshot tool gave them
- Drag-and-drop reordering of staged images before upload
- Thumbnail generation in the browser (we render the full image at `120px` height; browsers scale fine for screenshots under 10 MB)
- WebSocket push that an attachment was added by another user mid-edit
- Rich-text formatting inside the gallery caption
- Changing the backend's `/attachments` (single-file) contract — untouched; still used by other panels that upload documents, not screenshots
- Retry-with-backoff on failed uploads — a single toast + staged-file-remains-in-preview is enough for v1
- Tests of the backend bulk endpoint — covered by api-042

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testResult.ts` | `ResultAttachment.url`, `BulkUploadResponse` |
| api | `src/api/testResults.ts` | `uploadAttachmentsBulk(resultId, files)`; single-file helper retained |
| store | `src/stores/testResults.ts` | `uploadAttachmentsBulk` action with in-place `attachments` merge; deduplication with existing ids |
| component | `src/components/common/ImageUploadArea.vue` | Multi-image paste + drag; `:max-files`, `:accept` props; client-side validation with partial-accept toasts |
| component | `src/components/test-results/ResultAttachmentGallery.vue` (new) | Thumbnail strip + lightbox; reload-on-expire affordance |
| component | `src/components/test-runs/TestResultDetail.vue` | Use shared paste path; `update-comment` now carries `{ comment, files }`; render gallery on read mode |
| view | `src/views/test-runs/TestRunExecutionView.vue` | Remove duplicate global paste listener; `saveComment` calls `uploadAttachmentsBulk`; partial-failure toast |
| view | `src/views/test-runs/TestRunDetailView.vue` | `handleUpdateComment({ comment, files })` calls `uploadAttachmentsBulk` before `updateTestResult`; gallery under each result in the Results panel |
| composable | `src/composables/usePdfExport.ts` | Fetch attachment `url` → data-URL → `doc.addImage`; 3-per-result cap; "+N more" row |
| composable | `src/composables/useExcelExport.ts` | `workbook.addImage` + `worksheet.addImage`; row height; "+N more" cell text |
| tests | `src/components/common/__tests__/ImageUploadArea.spec.ts` (extend) | Multi-paste, deduping, validation, drag-drop |
| tests | `src/components/test-results/__tests__/ResultAttachmentGallery.spec.ts` (new) | Thumbnails, lightbox, expired-URL reload |
| tests | `src/stores/__tests__/testResults.spec.ts` (extend) | `uploadAttachmentsBulk` merges into `results[id].attachments` |
| tests | `src/composables/__tests__/usePdfExport.spec.ts` (extend) | Image embed + failure fallback |
| tests | `src/composables/__tests__/useExcelExport.spec.ts` (extend) | Image bytes present in workbook |
| tests e2e | `tests/e2e/test-result-attachments.spec.ts` (new) | Paste → save → reload → visible; PDF export with images |

### Key decisions

- **One bulk request per save, not a fan-out.** Fan-out N one-file requests is what the original plan-065 attempted and why it never shipped — UI feedback for N independent promises is painful and the total latency is N × RTT. The backend bulk endpoint lets the UI track a single loading state with a single error path.
- **Paste handler lives in `ImageUploadArea.vue`, not in the view.** The view-level global `document.addEventListener("paste", ...)` pattern leaks across the entire page — e.g. a user who Ctrl+V's while focused on the project name filter in the header accidentally attaches a screenshot to the currently-selected result. Scoping the handler to the image-upload area (component-level listener on focus-in) removes that whole class of surprise. This is a behaviour change; document it in the changelog.
- **Gallery is its own component.** `ResultAttachmentGallery.vue` is used in three places (detail panel, detail-view results panel, maybe future reports preview). Extracting it now avoids drift.
- **No `<img>` inline in the comment body.** Keeping `attachments` as a sibling array (vs inlining into the rich-text `comment` string) keeps the data model simple: the backend already has a dedicated `result_attachments` table, and report exports can iterate attachments instead of parsing HTML. Deferred via tech-debt if users ask.
- **Render via `img.src = attachment.url` directly.** The presigned URL is an http GET a browser handles natively. No client-side bytes juggling, no `Blob` / `URL.createObjectURL` dance. TTL expiry (15 min) is handled by the "reload" affordance, not by pre-emptive refresh timers.
- **PDF fetches the image bytes at export time.** jsPDF's `addImage` wants base64; the composable fetches the presigned URL, converts via `FileReader.readAsDataURL`, embeds, and releases. Does one fetch per image at export time — cheap, and the backend sends the longer "report TTL" presigned URL in the report payload specifically for this use case.
- **Excel embed uses exceljs's `addImage`.** The backend embeds server-side for server-generated reports; the frontend composable matches by embedding client-side for browser-triggered exports. Same visual result, different code paths, covered by the same unit test shape.
- **Partial-accept client-side.** If a user pastes a screenshot + a Word document, we don't reject the whole batch; we keep the screenshot, toast the document. Mirrors the backend bulk endpoint's `{ uploaded, failed }` shape.
- **Size cap is the backend's number.** The TS helper imports `MAX_ATTACHMENT_BYTES` via a generated config shim (or hard-codes 10 MB as a constant with a code comment pointing at the backend setting). Prefer the first; the config drift risk is real.
- **Deduplication keyed on `(size, name, lastModified)`.** Two Ctrl+V's in rapid succession are the common case; the composite key is cheap and good-enough.
- **Gallery click → `Galleria` lightbox, not `window.open(url)`.** Keeps users in-app; no new tab flood.
- **URL expiry handled by "reload images" button, not by auto-refresh timer.** A 15-min idle page with a dozen expired URLs is the common case; a single button click refetches `results` and repopulates URLs. Auto-refresh timers lead to stale state and unnecessary traffic.
- **Store action is additive, not a rewrite of `uploadAttachment`.** Other panels use single-file upload for non-screenshot attachments; replacing the signature would force call-site changes elsewhere for no gain.
- **Type contract stays fat.** `ResultAttachment.url` is required (not optional). If the backend ever returns an attachment without a URL, that's a backend bug and we want TypeScript to surface it, not the render layer to silently show nothing.

---

## Tasks

### Implementation
- [ ] Update `src/types/testResult.ts`: add `url: string` to `ResultAttachment`; add `BulkUploadResponse` type
- [ ] Add `uploadAttachmentsBulk(resultId, files)` in `src/api/testResults.ts`:
  - [ ] Build `FormData`; append every `File` under the same key `files`
  - [ ] `POST /test-results/{id}/attachments/bulk` with `Content-Type: multipart/form-data` (Axios sets boundary)
  - [ ] Return `BulkUploadResponse`
- [ ] Update `ResultAttachmentResponse` consumer type in `src/api/testResults.ts` to surface `url`
- [ ] Add `uploadAttachmentsBulk(resultId, files)` action in `src/stores/testResults.ts`:
  - [ ] Call the API helper
  - [ ] For each `uploaded` attachment, push into `results.find(r => r.id === resultId).attachments` (replace if id already exists — idempotent re-save)
  - [ ] Return the full `BulkUploadResponse` so callers can surface failures
- [ ] Rewrite `ImageUploadArea.vue`:
  - [ ] `handlePaste(e: ClipboardEvent)`: iterate `e.clipboardData?.items` — filter `image/*`, map to `getAsFile()`
  - [ ] `handleDrop(e: DragEvent)`: iterate `e.dataTransfer?.files` — filter `image/*`
  - [ ] Dedupe both batches against the current staged list via `(name, size, lastModified)` triple
  - [ ] Enforce caps; toast ignored files with a single grouped message
  - [ ] Emit `update:files` with the updated list
  - [ ] Add `:max-files`, `:accept`, `:max-size-bytes` props (defaults match backend)
  - [ ] Remove the "first-image-only" bug: `clipboardData.items[0]` → `for (const item of items)`
- [ ] Remove the duplicate global paste listener in `TestRunExecutionView.vue`:
  - [ ] Delete `handleGlobalPaste` (`:518-522`) and the `document.addEventListener` in `onMounted` / `onBeforeUnmount`
  - [ ] Keep the panel using `<ImageUploadArea>` as before; paste into the area works
- [ ] Same removal in `TestResultDetail.vue`:
  - [ ] Delete `handleGlobalPaste` (`:268-304`) and related watcher
  - [ ] `<ImageUploadArea>` inside the edit panel carries the listener scoped to its focus
- [ ] Build `ResultAttachmentGallery.vue`:
  - [ ] Props: `attachments: ResultAttachment[]`, `max-preview: number = 6`
  - [ ] Render `<img>` thumbnails, 120px tall, border / rounded corners per design-system tokens
  - [ ] Click opens PrimeVue `Galleria` (lightbox); ESC closes
  - [ ] Render "+N more" tile when `attachments.length > max-preview`
  - [ ] "Reload images" button, visible when any `img` fires `error` (bound via `@error` handler flipping a ref)
  - [ ] On reload click, emit `reload-requested` so the parent can `fetchResults(runId)` without the gallery owning store access (keeps the component presentational)
  - [ ] Empty state: renders nothing when `attachments.length === 0`
- [ ] Integrate gallery:
  - [ ] `TestResultDetail.vue` — render below the read-mode comment text
  - [ ] `TestRunDetailView.vue` — render under each result row in the Results panel
  - [ ] Both views respond to `reload-requested` by calling the existing refresh path
- [ ] Rewrite `saveComment()` in `TestRunExecutionView.vue`:
  - [ ] `await testResultsStore.submitResult(runId, payload)` — returns the result
  - [ ] `const newFiles = currentImages.filter(i => !i.isExisting).map(i => i.file)`
  - [ ] If `newFiles.length > 0`, `const resp = await testResultsStore.uploadAttachmentsBulk(resultId, newFiles)`
  - [ ] Toast summary: "Saved" / "Saved; N attachment(s) failed" with filenames
  - [ ] Images in `resp.failed` remain in `currentImages` with `!isExisting`; user can retry
  - [ ] Images in `resp.uploaded` are re-hydrated with `isExisting: true` via the store merge
  - [ ] Update the pass/fail/block path from plan-065 to use the bulk call (delete the old single-file loop)
- [ ] Rewrite `handleUpdateComment` in `TestRunDetailView.vue` (completing plan-073's roadmap):
  - [ ] Accept `{ comment, files }`
  - [ ] If `files.length > 0`, `uploadAttachmentsBulk(resultId, files)` first
  - [ ] Then `updateTestResult(resultId, { comment })`
  - [ ] Toast based on the combined outcome
- [ ] `TestResultDetail.vue`:
  - [ ] Update `saveComment()` emit to `update-comment` with `{ comment, files: newFiles, removedExistingIds: [...] }`
  - [ ] Parent handler diffs: new files → bulk upload; removed existing → loop `deleteAttachment`
- [ ] `usePdfExport.ts`:
  - [ ] After rendering the steps table for each result, if `result.attachments.length > 0`, fetch up to 3 URLs in parallel via `Promise.allSettled`
  - [ ] Convert each to data-URL via `FileReader`
  - [ ] `doc.addImage` at a fixed 160×90 thumbnail box; click-through hyperlink (`doc.link`) to the URL
  - [ ] "+N more — open in app" line when `attachments.length > 3`
  - [ ] Failure fallback per image: `[image unavailable — open in app]`
- [ ] `useExcelExport.ts`:
  - [ ] Add "Screenshots" column to the results worksheet
  - [ ] For each result row, fetch up to 3 URLs; `workbook.addImage({ base64, extension })` + `worksheet.addImage(id, { tl: {col, row}, ext: {width: 120, height: 80} })`
  - [ ] Set row height to 80px for rows with images
  - [ ] "+N more" cell text when overflow
- [ ] Unit tests:
  - [ ] `ImageUploadArea.spec.ts` — multi-paste (3 images), mixed paste (2 images + 1 PDF → 2 accepted + toast), over-cap (11 images), drag-drop multi, dedupe, prop overrides
  - [ ] `testResults.store.spec.ts` — bulk upload merges into correct result's attachments; failures bubble up; doesn't clobber sibling results
  - [ ] `ResultAttachmentGallery.spec.ts` — empty list renders nothing; thumbnails clickable; reload button surfaces on simulated img `error`; emits `reload-requested`
  - [ ] `usePdfExport.spec.ts` — embed adds 3 images per result max; gracefully handles one failing fetch; "+N more" appears
  - [ ] `useExcelExport.spec.ts` — workbook contains image base64; correct image count; row height set
  - [ ] `TestRunExecutionView.spec.ts` — saveComment happy path calls bulk upload once; partial failure keeps failed images in staged list
  - [ ] `TestRunDetailView.spec.ts` — handleUpdateComment uploads files before updating comment; error toast on either failure
- [ ] E2E:
  - [ ] `/test-runs/:id/execute` — paste 2 PNGs, click Save, reload, gallery shows 2 thumbnails; clicking opens lightbox
  - [ ] `/test-runs/:id` — edit comment, paste 3 PNGs, Save, gallery shows 3 under the result row
  - [ ] Reports — download a PDF for a run with screenshots; save the PDF to disk; assert byte-size is meaningfully larger than without attachments (soft check — the jsPDF doc can be parsed further if Playwright has a PDF parser)
  - [ ] Partial failure stub — one of two files rejected by the backend; toast appears; the rejected file's preview stays
- [ ] Manual smoke (dev server against api-042 branch):
  - [ ] Paste screenshot from OS screenshot tool (macOS ⌘+Shift+4, Linux GNOME screenshot, Windows Snip & Sketch) — works on all three
  - [ ] Drag a file from the OS file manager — works
  - [ ] Drag a file that's 15 MB — rejected locally with toast, no request fired
  - [ ] Leave the page open for 20 min, come back, try to view a screenshot — URL expired, "reload images" button appears, click it, thumbnails come back
  - [ ] Dark mode rendering of the gallery + lightbox

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (check TypeScript inference on the new `BulkUploadResponse` type — no `any` fallbacks)
- [ ] `npm run test:e2e` — new e2e specs green
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [ ] Lighthouse on `/test-runs/:id` with a run that has many screenshots — LCP within budget (the gallery lazy-loads beyond `max-preview`; verify)

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — new `uploadAttachmentsBulk` function; `ResultAttachment.url` field
- [ ] `docs/01-product/features/004-test-execution.md` — note that screenshots persist via paste and display inline; multiple per result; shown in reports (this is the feature doc the user's complaint was about)
- [ ] `docs/01-product/features/006-reporting.md` (or equivalent) — exports now embed screenshots
- [ ] `docs/02-architecture/frontend/state-management.md` — document the `testResults.uploadAttachmentsBulk` action and its in-place merge pattern; note that attachments resolve via presigned URLs not proxied downloads
- [ ] `docs/03-engineering/patterns/component-patterns.md` — short note on the `ImageUploadArea` paste-scoping (no global listeners)
- [ ] `docs/08-decisions/changelog.md` — entries:
  - [ ] Result-comment paste now captures all clipboard images, not just the first
  - [ ] Screenshots upload via a single bulk request per save
  - [ ] Gallery component renders attachments inline in detail + execute views
  - [ ] PDF / Excel exports embed screenshots (capped at 3 per result)
  - [ ] Global `document`-scoped paste listeners removed in favour of component-scoped handlers
- [ ] `docs/04-execution/tech-debt.md`:
  - [ ] Resolve: _"Payload builder duplication — `saveComment` and `submitResult` build nearly-identical result payloads"_ (shared bulk path folds both)
  - [ ] Add: inline-`<img>`-in-comment-body rich-text (deferred)
  - [ ] Add: URL-expiry handling via a refresh interceptor instead of per-gallery reload button
  - [ ] Add: image thumbnailing in the browser before upload for screenshots > 2 MB (bandwidth)
  - [ ] Add: drag-and-drop reordering in the staged-image list
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend plan-042 not merged yet; frontend is dead code | High during dev, **blocker** | Feature-flag gate: if `ResultAttachment.url` is missing on a fetched result, fall back to "no gallery + no upload". Land this plan **after** api-042 is merged to main. |
| Users on a stale tab paste into the comment area after URL expiry and the preview fetch shows a broken image | Medium | URL is for existing attachments only; freshly-pasted images use a local `URL.createObjectURL` blob URL until upload completes |
| `Galleria` lightbox z-index conflicts with the split-panel | Low | Test in a dialog context; PrimeVue 4's `Galleria` supports `appendTo="body"` |
| Very large screenshots (phone screenshots at 4000×2000) render expensive thumbnails | Low | `<img>` with fixed height; CSS `object-fit: cover`; browser handles downscale. Revisit if profiling says otherwise. |
| `exceljs` image insert is slow on 200+ result workbooks | Medium | Benchmark; if slow, offer an "export without screenshots" toggle in the export dialog; capped at 3/result helps |
| jsPDF data-URL embed blocks the main thread on image-heavy reports | Medium | `Promise.allSettled` across all fetches before any `addImage` call; pagesplitting in jsPDF already handles page overflow |
| Paste into a non-comment area (e.g. the nav bar search input) now fails to stage an image because the global listener is gone | Low — actually correct behaviour | Document in changelog as intentional; support matches standard web apps (GitHub, Jira) |
| Partial-upload UX confuses users ("1 of 3 uploaded? did the comment save?") | Medium | Toast text is explicit: "Comment saved. 1 of 3 images failed — click Save again to retry." |
| Safari clipboard API delivers `image/tiff` which we don't accept | Low | Include `image/tiff` in the MIME whitelist? — no; fall back on the toast saying "unsupported type"; revisit if actual users report it |
| Deduplication by `(name, size, lastModified)` fails for pasted clipboard images, which all have `name = "image.png"` and `lastModified = Date.now()` | Medium | For pasted images, also dedupe by byte-hash (`crypto.subtle.digest('SHA-1', await file.arrayBuffer())` on first 1 MB) if name-size-mtime collide within 500ms of each other |
| E2E paste is flaky in Playwright across Chromium / Firefox / WebKit | Medium | Use a drag-drop fixture (`dispatchEvent` with `DataTransfer`) instead of the real clipboard — this is how the plan-065 e2e suite was supposed to work but didn't ship |
| `v-html` in comment body + img rendering triggers a DOMPurify tech-debt item | Low — unrelated | Gallery renders images via bound `<img>` (not `v-html`); the comment text path is unchanged |
| Lighthouse regression from image-heavy detail views | Low | Lazy-load thumbnails beyond the first 6 (`loading="lazy"` attribute); defer `Galleria` import until first click |
| Presigned URL TTL mismatch: frontend assumes 15 min, backend ships with 10 min | Low | Backend sends `X-Attachment-URL-TTL` response header? — no, overkill. Gallery's "reload images" button handles it generically; doc the two TTLs in the SECURITY page |

---

## Definition of done

- [ ] `/test-runs/:id/execute` — Ctrl+V on the comment area stages **all** pasted images (not just the first); clicking Save uploads them in a single bulk request; after save, the images appear under the comment as a gallery
- [ ] `/test-runs/:id` — editing the comment in the detail panel and pasting images, then saving, uploads them and renders the gallery under the result row
- [ ] Drag-and-drop of multiple image files behaves identically to multi-paste
- [ ] Unsupported files (PDF, TXT, etc.) are rejected client-side with a toast, not shipped to the backend
- [ ] Over-cap batches (>10 files) rejected client-side with a toast
- [ ] Client-side and backend MIME / size rules are aligned (confirmed by unit test that asserts the shared constants match)
- [ ] Gallery opens a lightbox on click; ESC closes
- [ ] Expired presigned URLs surface a "Reload images" button; clicking refetches results
- [ ] PDF report export embeds up to 3 thumbnails per result; "+N more" line when overflow
- [ ] Excel report export inserts images as inline cells in the Screenshots column; same cap
- [ ] Partial upload failures (e.g. 2 of 3) leave failed files in the staged list for retry; toast reports the split
- [ ] Backend-plan-042 endpoint is the only call site for new uploads on this flow — the old one-file-per-request loop is gone from both views
- [ ] Global `document`-scoped paste listeners removed; paste only works when focus is inside the comment area or staged-image list
- [ ] `ResultAttachment.url` is a required TS field across the codebase; no `?.` optional chaining needed at call sites
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build`, `npm run test:e2e` all green
- [ ] Dark-mode rendering of the gallery + lightbox verified
- [ ] Docs updated across api-schema, feature docs, state-management pattern doc, component patterns, changelog, tech-debt
- [ ] This plan moved to `completed/`
- [ ] PR review and merge
