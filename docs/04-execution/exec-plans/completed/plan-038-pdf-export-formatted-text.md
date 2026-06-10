# Execution Plan: Preserve Rich Text Formatting in PDF Export

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-038-pdf-export-formatted-text.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Render rich text formatting (bold, italic, lists, code, links) in the PDF export for test case descriptions, preconditions, and test steps instead of stripping all HTML to plain text.

---

## Context

The `usePdfExport.ts` composable uses a `stripHtml()` function (line 80) that removes all HTML tags before writing content to the PDF via jsPDF. This was appropriate when all fields were plain text, but with Tiptap rich text being added to description, preconditions, and test step fields (Plan 031), the PDF export will lose all formatting — bold text, lists, code blocks, and links become flat text.

jsPDF has limited native HTML support. The standard approach is to use `jspdf-html2canvas` or jsPDF's `html()` method to render HTML, but these require DOM rendering. A more practical approach for structured Tiptap content is to parse the HTML and apply jsPDF text styling (bold, italic, font changes) based on the tags encountered.

**Depends on**: Plan 031 (Tiptap for all fields) — this plan should execute after rich text is in place.

---

## Scope

### In scope

- Replace `stripHtml()` with a HTML-to-PDF renderer for description, preconditions, and test step fields
- Support key Tiptap formatting in PDF: **bold**, *italic*, ~~strikethrough~~, bullet lists, ordered lists, code (monospace), links (underlined text), headings (font size), paragraphs (line breaks)
- Keep the existing PDF layout structure (headers, tables, page breaks)

### Out of scope

- Rendering images/screenshots embedded in rich text (existing screenshot export handles attachments separately)
- Supporting complex HTML (nested tables, iframes)
- Excel export formatting (Excel cells don't support rich text easily — keep `stripHtml()` for Excel)
- Changing the PDF layout or page structure

---

## Technical approach

### Option A — jsPDF `html()` method (chosen)

jsPDF has a built-in `html()` method that renders an HTML string by temporarily mounting it in the DOM and using html2canvas. This handles all Tiptap formatting natively.

```ts
async function renderHtmlToPdf(
  doc: jsPDF,
  html: string,
  x: number,
  y: number,
  maxWidth: number,
): Promise<number> {
  // Create a temporary container with tiptap-content styles
  const container = document.createElement('div');
  container.className = 'tiptap-content';
  container.style.width = `${maxWidth}px`;
  container.style.fontSize = '9px';
  container.style.fontFamily = 'helvetica, sans-serif';
  container.innerHTML = html;
  document.body.appendChild(container);

  await doc.html(container, {
    x,
    y,
    width: maxWidth,
    windowWidth: maxWidth,
  });

  const height = container.offsetHeight;
  document.body.removeChild(container);
  return height; // Return rendered height for yPosition tracking
}
```

**Trade-off**: Requires DOM access (fine in browser context). Slightly heavier than manual parsing but handles all formatting correctly with zero custom parsing code.

### Option B — Manual HTML tag parser

Parse HTML tags and map to jsPDF font style calls (`setFont('helvetica', 'bold')`, etc.). More control but requires maintaining a parser for every Tiptap output format.

Going with **Option A** — simpler, handles all formatting, and the `.tiptap-content` CSS class (from Plan 031) ensures consistent styling.

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| composables | `src/composables/usePdfExport.ts` | Add `renderHtmlToPdf` helper; replace `stripHtml()` calls for description, preconditions, and step fields with HTML rendering; keep `stripHtml()` for comment fields and summary text where plain text is appropriate |

### Fields to update

| Field | Current (line) | Change |
|-------|---------------|--------|
| Description | `stripHtml(testCase.description)` (line 373) | → `renderHtmlToPdf(doc, testCase.description, ...)` |
| Preconditions | `stripHtml(testCase.preconditions)` (line 388) | → `renderHtmlToPdf(doc, testCase.preconditions, ...)` |
| Step Action | `stripHtml(step.step).substring(0, 80)` (line 407) | → render HTML in table cell (may need `jspdf-autotable` html cell support or pre-render to styled text) |
| Step Expected | `stripHtml(step.expected).substring(0, 80)` (line 408) | → same as above |
| Comment | `stripHtml(result.comment)` (line 460) | → keep as `stripHtml()` (comments are typically short plain text) |

### Test steps table consideration

The steps are rendered in a `jspdf-autotable` table. autotable doesn't natively support HTML in cells. Two approaches:

1. **Pre-render each cell**: Use a lightweight HTML-to-text-with-formatting function that converts `<strong>` to bold text markers, `<ul>` to `• ` prefixed lines, etc., and apply inline styles via autotable's `didParseCell` hook.

2. **Render steps as individual sections instead of a table**: Replace the autotable for steps with individual rendered HTML blocks per step. Loses the table structure but gains full formatting.

Going with approach **1** for steps — keeps the table layout while adding basic formatting support via autotable's styling hooks.

### Key decisions

- **`html()` method for description/preconditions**: These are longer blocks where full formatting matters. The temporary DOM approach is well-supported by jsPDF.
- **Styled text for step table cells**: Use autotable's `didParseCell` hook with a simple tag parser for bold/italic only. Lists in steps are converted to bullet-prefixed lines.
- **Keep `stripHtml()` for comments**: Comments are short, typically unformatted. Plain text is fine.
- **Fallback to plain text**: If HTML rendering fails, fall back to `stripHtml()` with a console warning. PDF export should never break due to formatting.

---

## Tasks

### Implementation

- [x] Add `renderHtmlToPdf` helper function to `usePdfExport.ts`
- [x] Replace `stripHtml(testCase.description)` with HTML rendering for the description section
- [x] Replace `stripHtml(testCase.preconditions)` with HTML rendering for the preconditions section
- [x] Add basic HTML-to-styled-text converter for step table cells (bold, italic, bullet lists)
- [x] Update step table rendering to use styled text via autotable `didParseCell` hook
- [x] Add fallback: if HTML rendering fails, fall back to `stripHtml()` gracefully
- [x] Test: create test case with rich description + steps → export PDF → verify bold, lists, code render correctly
- [x] Test: export PDF with plain-text content (pre-Tiptap) → verify no regression

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note HTML-to-PDF rendering approach
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `html()` method increases PDF generation time | Medium | Only used for description/preconditions (2 calls per test case); steps use lightweight parser. Acceptable for export. |
| Temporary DOM container flashes on screen | Low | Container is appended and removed quickly; can add `visibility: hidden` + `position: absolute` to prevent flash |
| Complex HTML content overflows page | Medium | Set `maxWidth` to content width; use `checkPageBreak` before rendering; cap content length if needed |
| autotable cell styling doesn't support all formatting | Medium | Support bold/italic/lists only in cells — sufficient for most step content. Full formatting available in description/preconditions. |
| `html()` not available in SSR/test environment | Low | PDF export is browser-only; tests mock the composable. Add DOM check guard. |

---

## Definition of done

- [x] PDF export renders bold, italic, and lists in description and preconditions sections
- [x] PDF export renders basic formatting (bold, italic, bullet points) in test step table cells
- [x] Plain-text content (without HTML) exports correctly (no regression)
- [x] Comments still export as plain text
- [x] PDF generation doesn't break if HTML content is malformed (fallback to plain text)
- [x] All quality checks pass (lint, test, build)
