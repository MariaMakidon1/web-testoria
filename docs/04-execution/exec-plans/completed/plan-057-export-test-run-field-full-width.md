# Execution Plan: Make the "Test Run" field span full width in PDF and Excel exports

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

In the PDF and Excel report exports, make the "Test Run" field on the summary section use the full page / sheet width so long run names render in full and never overflow or truncate.

---

## Context

Both exporters render a summary line/cell for the selected test run's name, and both currently constrain that field to a narrow slot:

- **PDF** (`src/composables/usePdfExport.ts:464-469`):
  ```ts
  if (data.testRun) {
    doc.setFontSize(10);
    doc.text(`Test Run: ${data.testRun.name}`, margin, yPosition);
    yPosition += 5;
    doc.text(`Status: ${data.testRun.status}`, margin, yPosition);
    ...
  }
  ```
  The line is drawn as a single `doc.text` call with no `maxWidth`. Long run names overflow off the right page edge — they're not wrapped, not ellipsised, just clipped when the PDF is rendered. `contentWidth` (page width minus margins) is available in this function but not passed in.

- **Excel** (`src/composables/useExcelExport.ts:144-152`):
  ```ts
  if (data.testRun) {
    sheet.getCell("A6").value = "Test Run:";
    sheet.getCell("B6").value = data.testRun.name;
    ...
  }
  // Column widths: A=20, B=30  (lines 199-200)
  ```
  The run name sits in a single cell in column B (width 30). Column B also holds every other metadata value (project name, generated-at, status), so widening column B would make the stats section look wrong. The correct fix is to **merge** the test-run-name cell across all summary columns, keep the label cell in column A, and enable wrap-text so long names reflow instead of truncating.

Two small layout changes, one per exporter. No data-shape change, no new dependency. Falls under the existing "PDF/Excel export polish" tech line.

---

## Scope

### In scope
- **PDF**: render the `Test Run: <name>` line across the full content width with wrap-on-overflow using `doc.splitTextToSize(..., contentWidth)`; measure line count and advance `yPosition` accordingly
- **Excel**: merge the value cell for the test run name across the full summary column range (e.g., `B6:D6` if the summary uses A-D), enable `alignment: { wrapText: true, vertical: "top" }`, grow the row height to fit, keep column A as the label column, do not widen column B globally
- Apply the same pattern to the "Status" and "Completed" follow-up lines in the PDF so they align under the name consistently (nice-to-have; low cost since the wrapping utility is already in hand)
- Verify both exports render correctly for:
  - Short name (single line / single merged cell, no visual regression)
  - Long name (≥ 80 chars, wraps or extends)
  - Empty / missing run (existing guard `if (data.testRun)` still skips the section)
- Unit test the PDF helper: given a long string and a `contentWidth`, `splitTextToSize` returns > 1 line and `yPosition` advances by `lineCount * lineHeight`
- Visual-regression-style snapshot: generate both files against a seeded run with a deliberately long name; open, inspect, attach to the PR

### Out of scope
- Redesigning the summary section (card colors, stats grid, fonts)
- Changing other column widths on the Excel sheets (Test Cases, Test Results, Attachments) — this plan only touches the Summary sheet's test-run row
- Adding new fields to the export (suite path, tags, milestones) — separate plans
- Pagination / header-footer polish on the PDF
- i18n of labels
- Any plan-054 / plan-032 follow-up work (renaming `skipped` → `no_run` in exports) — that is already in plan-054's task list; this plan doesn't touch status strings

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| exports | `src/composables/usePdfExport.ts` | In `addSummary()` (around line 464), wrap the test-run name (and optionally Status / Completed lines) via `doc.splitTextToSize(\`Test Run: ${name}\`, contentWidth)`; advance `yPosition` by `lines.length * lineHeight` |
| exports | `src/composables/useExcelExport.ts` | In `addSummarySheet()` (around line 144), merge the value cell (e.g., `sheet.mergeCells("B6:D6")`), set `alignment: { wrapText: true, vertical: "top" }` on the merged cell, bump the row height (`sheet.getRow(6).height = Math.max(20, estimatedLines * 15)`); the label cell in A6 stays as-is |
| exports | `src/composables/useExcelExport.ts` | Use the same merge + wrap for the "Status" and "Completed" rows if kept on adjacent rows, so the summary block reads as a vertical stack of full-width value cells under their labels (optional but consistent) |
| tests | `tests/unit/composables/usePdfExport.spec.ts` | Unit test for the wrapping calculation: short name → 1 line; long name → ≥ 2 lines; `yPosition` increment matches |
| tests | `tests/unit/composables/useExcelExport.spec.ts` | Unit test that the merged range is present and `wrapText` is true after calling `addSummarySheet` with a long run name |
| manual | — | Open generated PDF and XLSX in Acrobat / Excel / LibreOffice to confirm visual output |

### Key decisions

- **Use the existing `contentWidth` in the PDF**. It's already computed as `pageWidth - margin * 2` elsewhere in the file; thread it through `addSummary()` if it isn't already in scope (it should be — `addSummary` is a closure inside `exportToPdf` which has `pageWidth` and `margin`).
- **Merge cells in Excel, don't widen column B**. Widening column B globally would distort every other metadata row. Merging the specific row across all summary columns (likely A or B through D) gives a "100% width value" appearance under the label without affecting stats rows.
- **Wrap, don't shrink**. Shrinking the font size to fit long names is worse UX than wrapping onto a second line — names remain legible at the same size as other summary fields.
- **Line-height calculation in PDF**. jsPDF default line height for `setFontSize(10)` is ~5pt. Current code already advances `yPosition += 5` for single-line cases — generalise to `yPosition += lines.length * 5` after the `doc.text(lines, ...)` call. A single helper `writeWrappedLine(label, value)` reduces repetition.
- **Merge range in Excel**. The summary currently uses columns A-B. The stats table below uses only A-B as well. Merging the test-run value across `B:D` (or `B:E`) reads as "100% width" in practice because no other column extends to the right on the summary sheet. Pick `B:D` — Excel's visible summary area is 4 columns; D is the last column used by the stats grid in plans 050 / 052 dashboards.
- **Keep the "if (data.testRun)" guard**. Export without a selected run is valid; the summary just skips these rows. Merge calls are only issued when the run exists.
- **No change to how the data is selected or assembled**. This is presentation-only.

---

## Tasks

### Implementation
- [ ] PDF: add a small helper inside `exportToPdf` closure (or near the top of the module) — `writeWrappedLine(text, x, y, maxWidth, lineHeight)` — that wraps, draws, and returns the consumed height
- [ ] PDF: replace the three direct `doc.text` calls for Test Run / Status / Completed with `writeWrappedLine` calls using `contentWidth`
- [ ] PDF: advance `yPosition` by the returned height (not a fixed 5)
- [ ] Excel: in `addSummarySheet`, after setting `B6` to the run name, call `sheet.mergeCells("B6:D6")`
- [ ] Excel: set `alignment: { wrapText: true, vertical: "top" }` on the merged cell
- [ ] Excel: compute row height based on name length (`Math.ceil(name.length / ~60) * 15` with a floor of 20) and set `sheet.getRow(6).height`
- [ ] Excel: apply the same merge + wrap to the "Status" row (B7) and any "Completed" row introduced by prior plans if present
- [ ] Verify the stats block immediately below still lines up (startRow = 9 stays correct; the merge affects only row 6/7, not column widths)
- [ ] Unit tests:
  - PDF helper: `writeWrappedLine` with a 200-char string returns height = `lines.length * lineHeight`, `lines.length >= 2`
  - Excel: call `addSummarySheet({ testRun: { name: 'a'.repeat(120), ... } })` and assert `sheet.getCell("B6").isMerged` and `alignment.wrapText === true`
- [ ] Manual output check:
  - Seed a run with a very long name (120+ chars); export both formats; open in Acrobat and Excel/LibreOffice; confirm no clipping
  - Short-name regression: export a run with a 10-char name; confirm no odd blank space or weird wrap
  - No-run case: export with `testRun` omitted; confirm the section is skipped as before

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/010-reports-dashboard.md` (or the export feature file) — note the layout fix
- [ ] `docs/08-decisions/changelog.md` — record: "PDF/Excel summary: test-run field now spans the full width and wraps"
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

*(No routes-map / api-schema / architecture change.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| PDF `yPosition` miscounted after wrapping — subsequent sections overlap with the wrapped lines | Medium | Return the exact consumed height from the helper; cover with the unit test; visual check on a long-name export |
| Excel merged cell conflicts with a later merge or with the stats block starting at row 9 | Medium | Merge only rows 6 and 7 (and 8 if Completed is present); the stats block begins at 9 regardless; confirm by inspecting the generated file |
| Wrap-text in Excel combined with the bumped row height makes the summary look "tall and empty" for short names | Low | Row-height formula uses `Math.max(20, ...)` — short names get the existing height |
| Column D doesn't exist on the summary sheet and merging `B:D` adds phantom columns | Low | Excel creates columns on demand; merging to D is safe; existing summary already renders values into B only, so D was effectively unused |
| jsPDF version renders `splitTextToSize` differently across platforms (Chrome vs Firefox wasm font metrics) | Low | jsPDF uses its own metrics, platform-independent; covered by unit test on line count |
| Long names containing URLs or no spaces don't wrap (single un-breakable token) | Medium | `splitTextToSize` breaks on characters when no spaces exist; confirm visually; if it doesn't, add a soft break every ~60 chars as a fallback |
| Row height over-estimates for names with many short words vs few long words | Low | Formula is approximate; over-estimating is harmless (slight extra whitespace) vs under-estimating (truncation) |

---

## Definition of done

- [ ] PDF: "Test Run: <name>" wraps onto multiple lines when the name is longer than `contentWidth`; no clipping at the right page edge
- [ ] PDF: `yPosition` advances correctly after wrapping; the "Blocked / Skipped" line and the following Test Cases table still render without overlap
- [ ] Excel: the test-run name cell spans the full summary width (merged across B:D or equivalent) with `wrapText: true`
- [ ] Excel: the row containing the test-run name grows its height to fit the wrapped text; short names keep the default height
- [ ] Short-name, long-name, and no-run cases all render cleanly
- [ ] Unit tests pass; manual visual check done in Acrobat + Excel / LibreOffice
- [ ] PR checklist completed
- [ ] Docs updated
