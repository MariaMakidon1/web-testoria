# Execution Plan: 004 — Test Case Import / Export

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Complete import/export parity: add Excel (`.xlsx`) parsing to `useImport`, surface XML export in the `ImportExportDialog`, and add row-level error display after a partial import.

---

## Context

Analysis found that `useImport` only handles JSON and CSV — Excel import is documented as supported but not implemented in the composable. `useExport` implements JSON, CSV, and XML but the UI only exposes JSON and CSV (XML is hidden). The import dialog also does not display per-row errors from the backend response (the `errors[]` array in the response is ignored in the current implementation).

---

## Scope

### In scope
- Add `.xlsx` parsing to `useImport` using `xlsx` or `exceljs` (whichever is already a project dependency — ExcelJS is)
- Surface XML as an export option in `ImportExportDialog`
- Display import error rows (row number + message) in the dialog after a partial import

### Out of scope
- Exporting with column field selection (deferred — currently all fields are exported)
- Import progress bar for large files (deferred — document as tech debt)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| composables | `src/composables/useImport.ts` | Add `parseExcel(file)` branch using ExcelJS; map sheet rows to the same schema as CSV rows |
| components | `src/components/common/ImportExportDialog.vue` | Add XML to export format options; add error list panel shown after import response |
| tests | `tests/unit/composables/useImport.spec.ts` | Extend with Excel file parsing tests (mock ArrayBuffer input) |

### Key decisions

- Use ExcelJS (already a project dependency) for parsing — avoid adding a new dependency.
- Excel import reads the first worksheet only; any additional sheets are ignored. This is noted in the UI tooltip.
- Import errors are displayed in a scrollable `DataTable` inside the dialog — columns: Row, Message. The user must acknowledge errors before the dialog closes.

---

## Tasks

### Implementation
- [ ] Add `parseExcel(file: File)` to `useImport` using ExcelJS
- [ ] Add XML option to export format selector in `ImportExportDialog`
- [ ] Add error list display panel in `ImportExportDialog` for partial import responses
- [ ] Extend `useImport` unit tests with Excel parsing cases

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/004-test-case-import-export.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| ExcelJS in browser context may have bundle size impact | Low | ExcelJS is already a dependency — no new cost |
| Backend mock always returns 0 errors, making error display untestable | Medium | Add a mock scenario that returns synthetic errors for test coverage |

---

## Definition of done

- [ ] `.xlsx` files can be imported end-to-end in mock mode
- [ ] XML export produces a valid `.xml` download
- [ ] Partial import errors are displayed per-row in the dialog
- [ ] Unit tests covering all three import formats pass
