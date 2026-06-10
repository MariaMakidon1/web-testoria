# Feature: Test Case Import / Export

## What it does

Test Case Import/Export allows bulk ingestion and extraction of test cases via file formats. Users can import test cases from CSV or Excel files into a project/suite, with row-level validation and error reporting. They can export the current filtered set of test cases to CSV, Excel, or JSON.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Import and export in any project |
| **Lead** | Import and export in their projects |
| **Tester** | Import and export (`canManageTests` flag) |
| **Read Only** | Export only (read access); cannot import |

## Key behaviours

### Import
- Entry point: `ImportExportDialog.vue` opened from `TestCaseListView`.
- Accepted formats: `.csv`, `.xlsx`.
- The API call is `importTestCases(projectId, FormData)` — the file is sent as multipart form data.
- The response includes `{ imported: number, errors: ImportError[] }` — partial import is allowed (valid rows are saved, invalid rows are reported).
- Each error in the response includes a row number and a message; these are displayed to the user after upload.
- `useImport` composable handles file parsing, validation, and calling the store action.

### Export
- Formats: CSV, Excel (`.xlsx`), JSON, XML.
- `useExport` composable handles CSV, JSON, and XML generation client-side. `useExcelExport` handles `.xlsx` generation separately via ExcelJS.
- Export respects the current active filters — only the visible/filtered set of test cases is exported, not the entire project.
- Export is triggered from the toolbar in `TestCaseListView`.
- The API call `exportTestCases(projectId, format)` returns a `Blob` that is downloaded via `file-saver`.

## Constraints / edge cases

- Import does **not** update existing test cases — it is insert-only. Duplicates (by title within the same suite) may be created if the file contains rows that match existing cases.
- The CSV/Excel column schema expected by the backend is documented in `docs/06-generated/api-schema.md`; the frontend does not perform schema validation itself — it delegates to the backend.
- Large file imports (thousands of rows) may take several seconds; the dialog shows a loading state during upload.
- Export with no active filters exports all test cases in the project (subject to pagination limits on the backend response).
- Import delegates validation to the backend; the frontend displays whatever errors the backend returns.

## Related docs

- `docs/06-generated/api-schema.md` — `importTestCases`, `exportTestCases` endpoints
- `src/composables/useImport.ts`
- `src/composables/useExport.ts`
- `src/composables/useExcelExport.ts`
- `src/components/common/ImportExportDialog.vue`
- `src/api/testCases.ts`
