# Feature: Attachments

## What it does

Attachments allow testers to upload screenshots, log files, or other evidence files to a TestResult during or after test execution. Uploaded files are stored against the result and can be viewed or downloaded by anyone with access to the result.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Upload and delete attachments on any result |
| **Lead** | Upload and delete attachments on results in their projects |
| **Tester** | Upload and delete attachments on results they are executing |
| **Read Only** | View and download attachments; cannot upload or delete |

## Key behaviours

- `ImageUploadArea.vue` provides a drag-and-drop file upload area embedded inside `TestResultDetail.vue`.
- In **production**, uploading calls `uploadAttachment(resultId, file)` — the file is sent as **multipart/form-data** to `POST /test-results/:id/attachments`.
- Each `Attachment` record contains:
  - `id: number`
  - `filename: string`
  - `file_path: string` — server-side storage path or URL
  - `file_size: number` — bytes
  - `mime_type: string`
  - `uploaded_at: string` — ISO timestamp
- Multiple attachments can be added to a single result.
- Deleting an attachment calls `deleteAttachment(resultId, attachmentId)` → `DELETE /test-results/:id/attachments/:attachId`.
- Attachments are displayed as a thumbnail grid (images) or file list (non-images) below the result form.

## Constraints / edge cases

- The backend handles file storage (S3 or equivalent). The `file_path` field returned by the API is the resolvable URL or server path — not the same as a browser-accessible URL unless the backend serves it.
- `ImageUploadArea.vue` enforces a **5 MB per-file limit** client-side via the `maxFileSize` prop (default: `5 * 1024 * 1024`). Files exceeding the limit are rejected before upload with a toast error.
- `ImageUploadArea.vue` shows an **upload overlay spinner** (`uploading` ref) while files are being processed, preventing duplicate submissions.
- Content type is read from `file.type` (browser MIME detection) — not validated against an allowlist on the frontend.
- Attachments are scoped to a TestResult — they cannot be attached to TestCases directly.
- Note: the `Attachment` type does not include an `uploaded_by` field — uploader identity is not stored on the attachment record in the current schema.

## Related docs

- `docs/06-generated/api-schema.md` — `uploadAttachment`, `deleteAttachment` endpoints
- `src/types/testResult.ts` — `Attachment` interface
- `src/components/common/ImageUploadArea.vue`
- `src/api/testResults.ts`
- `src/stores/testResults.ts`
- `docs/01-product/features/006-test-execution.md`
