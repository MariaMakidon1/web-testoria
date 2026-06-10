# Execution Plan: Fix Checkbox-Label Spacing in Export Report Dialog

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-037-export-checkbox-label-spacing.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Add proper spacing between checkboxes and their labels in the "Include in Report" section of the PDF/Excel export dialog.

---

## Context

In `ReportDashboardView.vue`, the export dialog has an "Include in Report" section with checkboxes for Test Steps, Comments, Screenshots, and Metadata (lines 887-920). The `.export-option` container uses `display: flex; align-items: center;` but has no `gap`. The labels use `class="ml-2"` (PrimeVue utility: `margin-left: 0.5rem`) but the visual spacing between the checkbox and label text is too tight, making it hard to read.

---

## Scope

### In scope

- Add `gap: 8px` to `.export-option` in `ReportDashboardView.vue`
- Remove the `ml-2` class from the labels (the `gap` handles spacing)

### Out of scope

- Changing checkbox size or style (covered by Plan 035 dark mode fix)
- Changing the export dialog layout

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/reports/ReportDashboardView.vue` | Add `gap: 8px` to `.export-option` style (line ~1230); remove `ml-2` class from checkbox labels (lines 894, 902, 910, 918) |

### Implementation

**CSS fix** (line ~1230):
```css
.export-option {
  display: flex;
  align-items: center;
  gap: 8px;  /* ADD */
}
```

**Template fix** — remove redundant `ml-2` from all 4 labels:
```vue
<!-- Before -->
<label for="includeSteps" class="ml-2">Test Steps</label>
<!-- After -->
<label for="includeSteps">Test Steps</label>
```

---

## Tasks

### Implementation

- [x] Add `gap: 8px` to `.export-option` in `ReportDashboardView.vue`
- [x] Remove `ml-2` class from all 4 checkbox labels (lines 894, 902, 910, 918)
- [x] Verify spacing looks correct in the export dialog

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)

- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| None — CSS-only change | N/A | N/A |

---

## Definition of done

- [x] Visible gap between checkboxes and labels in the export dialog
- [x] Spacing is consistent across all 4 checkbox options
- [x] All quality checks pass (lint, test, build)
