# Execution Plan: 008 — Attachments

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Add client-side file size and type validation to the upload flow, show upload progress feedback, and display `file_size` in a human-readable format in the attachment list.

---

## Context

The attachments feature is functionally complete. Analysis found: (1) no client-side file size limit is enforced — the frontend sends any file and relies on the backend to reject oversized uploads, giving the user no feedback until the API call fails; (2) there is no upload progress indicator; (3) the `file_size` field is stored in bytes but never displayed in the UI. The `Attachment` type also has no `uploaded_by` field — the feature doc has been corrected to reflect this.

---

## Scope

### In scope
- Client-side validation in `ImageUploadArea`: reject files larger than a configurable max size (default 10 MB) with an inline error message
- Show a progress spinner / loading state during upload
- Display `file_size` formatted as KB/MB in the attachment list

### Out of scope
- File type allowlist enforcement (deferred — too restrictive without a product decision on allowed types)
- Chunked upload for large files (deferred)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/common/ImageUploadArea.vue` | Add `maxFileSize` prop (default `10 * 1024 * 1024`); validate before calling store action; show error state |
| components | `src/components/common/ImageUploadArea.vue` | Show loading state (spinner overlay) while upload is in-flight |
| components | `src/components/test-runs/TestResultDetail.vue` | Display formatted `file_size` next to each attachment filename |

### Key decisions

- `maxFileSize` is a component prop (not a global config) so different contexts can enforce different limits in future.
- File size formatting uses a simple utility function: `formatBytes(bytes)` → `"4.2 MB"`. Defined inline or in a shared utils file if one exists.

---

## Tasks

### Implementation
- [ ] Add `maxFileSize` prop and validation to `ImageUploadArea`
- [ ] Add upload loading state to `ImageUploadArea`
- [ ] Add formatted `file_size` display to attachment list in `TestResultDetail`

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/008-attachments.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Mock upload has no latency — loading state is invisible during testing | Low | Artificial 200ms delay in mock for visual testing; do not ship delay to production |

---

## Definition of done

- [ ] Files over 10 MB are rejected before upload with a clear error message
- [ ] Upload shows a loading state while in flight
- [ ] Attachment list shows human-readable file size
