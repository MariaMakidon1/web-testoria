# Execution Plan: Fix Priority Colors on Test Run Create Page

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-035-priority-colors-test-run-create.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Display priority tags (low, medium, high, critical) with distinct, meaningful colors on the `/test-runs/create` page, fix the same bug wherever it exists across the app, and fix checked checkboxes being invisible in dark mode on the test cases selection table.

---

## Context

On the test run create page (`TestRunCreateView.vue`), the priority column in the test cases table renders all priorities in the same blue color. The root cause is a key casing mismatch — `getPrioritySeverity()` maps capitalized keys (`Critical`, `High`, etc.) but the API returns lowercase values (`critical`, `high`, etc.), so every priority falls through to the default `"info"` (blue).

This same bug exists in `TestCaseEditorView.vue` (line 175). Meanwhile `TestCaseDetailView.vue` (line 23) has it correct with lowercase keys. The function is duplicated in 3 files — it should be centralized.

Additionally, the Tag displays the raw lowercase API value (e.g., `critical`) instead of the human-readable label (e.g., `Critical`) via the existing `PRIORITY_LABELS` constant.

A second issue on the same page: in dark mode, checked checkboxes in the test cases DataTable are invisible. The checked state applies `background: var(--primary-color)` (#818cf8) to the checkbox box, but the checkmark icon color is never set — `--primary-color-text` is **used in 4 places but never defined** in either theme. Without an explicit white/light checkmark color, the check icon inherits a dark color and disappears against the purple background.

---

## Scope

### In scope

- Fix `getPrioritySeverity` key casing in `TestRunCreateView.vue` and `TestCaseEditorView.vue`
- Extract `getPrioritySeverity` into a shared utility (either in `types/testCase.ts` alongside the existing priority constants, or a composable) to eliminate duplication
- Use `PRIORITY_LABELS[priority]` for Tag display values instead of raw API values
- Apply fix to all 3 files that use this function
- Define `--primary-color-text` CSS variable in both light and dark themes (missing entirely)
- Fix dark mode checkbox checkmark visibility: add explicit `color: white` for checked checkbox icon

### Out of scope

- Changing the PrimeVue Tag severity-to-color mapping itself (uses built-in theme colors)
- Custom CSS colors for priorities (PrimeVue Tag severities are sufficient: danger=red, warning=orange, info=blue, success=green)
- Redesigning the checkbox component (only fixing the color)

---

## Technical approach

### 1. Centralize the function

Add to `src/types/testCase.ts` (alongside existing `PRIORITY_LABELS`, `PRIORITY_COLORS`):

```ts
export function getPrioritySeverity(
  priority: string,
): "danger" | "warning" | "info" | "success" {
  const map: Record<string, "danger" | "warning" | "info" | "success"> = {
    critical: "danger",   // red
    high: "warning",      // orange
    medium: "info",       // blue
    low: "success",       // green
  };
  return map[priority] || "info";
}
```

### 2. Update all consumers

Replace the local `getPrioritySeverity` function in each file with an import:

```ts
import { getPrioritySeverity, PRIORITY_LABELS } from "@/types/testCase";
```

### 3. Fix Tag display values

In `TestRunCreateView.vue`, the Tag currently shows raw values:

```vue
<Tag :value="data.priority" :severity="getPrioritySeverity(data.priority)" />
```

Change to use human-readable labels:

```vue
<Tag
  :value="PRIORITY_LABELS[data.priority] || data.priority"
  :severity="getPrioritySeverity(data.priority)"
/>
```

Apply the same fix in the selected cases list (line 534).

### 4. Fix missing `--primary-color-text` and dark mode checkboxes

In `src/assets/styles/main.css`, add the missing variable to both themes:

```css
[data-theme="light"] {
  /* existing vars... */
  --primary-color-text: #ffffff;
}

[data-theme="dark"] {
  /* existing vars... */
  --primary-color-text: #ffffff;
}
```

This fixes the 4 existing usages (stepper numbers, avatars) and provides the foundation for the checkbox fix.

Then add an explicit checkmark icon color for checked checkboxes in dark mode:

```css
[data-theme="dark"] .p-checkbox .p-checkbox-box.p-highlight {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--primary-color-text);  /* ← ADD: white checkmark */
}

[data-theme="dark"] .p-checkbox .p-checkbox-box.p-highlight .p-checkbox-icon {
  color: var(--primary-color-text);
}
```

Also add the light mode equivalent for consistency:

```css
.p-checkbox .p-checkbox-box.p-highlight .p-checkbox-icon {
  color: var(--primary-color-text);
}
```

### Expected color mapping

| Priority | Severity | Color |
|----------|----------|-------|
| critical | `danger` | Red |
| high | `warning` | Orange |
| medium | `info` | Blue |
| low | `success` | Green |

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testCase.ts` | Add exported `getPrioritySeverity` function |
| views | `src/views/test-runs/TestRunCreateView.vue` | Remove local `getPrioritySeverity`, import shared one, use `PRIORITY_LABELS` for Tag values |
| views | `src/views/test-cases/TestCaseEditorView.vue` | Remove local `getPrioritySeverity`, import shared one |
| views | `src/views/test-cases/TestCaseDetailView.vue` | Remove local `getPrioritySeverity`, import shared one |
| styles | `src/assets/styles/main.css` | Define `--primary-color-text` in both themes; add checkbox checkmark color for light and dark mode |

### Key decisions

- **Put in `types/testCase.ts`, not a composable**: It's a pure function with no Vue reactivity. It belongs next to `PRIORITY_LABELS` and `PRIORITY_COLORS` which it's semantically related to.
- **Lowercase keys**: The API returns lowercase. The mapping must use lowercase keys. Human-readable display uses `PRIORITY_LABELS`.
- **Keep PrimeVue Tag severities**: Built-in severity colors (danger/warning/info/success) provide distinct, accessible, theme-aware colors without custom CSS.
- **Define `--primary-color-text` globally**: The variable is already referenced in 4 places but never declared. Defining it fixes checkboxes, stepper numbers, and avatars all at once.
- **White checkmark in both themes**: Primary-color backgrounds always need white/light foreground text for contrast.

---

## Tasks

### Implementation

- [x] Add `getPrioritySeverity` function to `src/types/testCase.ts`
- [x] Update `TestRunCreateView.vue`: remove local function, import shared, use `PRIORITY_LABELS` for Tag display
- [x] Update `TestCaseEditorView.vue`: remove local function, import shared
- [x] Update `TestCaseDetailView.vue`: remove local function, import shared
- [x] Verify all 4 priority values render with distinct colors on `/test-runs/create`
- [x] Verify selected cases list also shows correct colors
- [x] Define `--primary-color-text: #ffffff` in both `[data-theme="light"]` and `[data-theme="dark"]` in `main.css`
- [x] Add `color: var(--primary-color-text)` to checked checkbox styles (`.p-checkbox .p-checkbox-box.p-highlight` and `.p-checkbox-icon`)
- [x] Verify checked checkboxes show a visible white checkmark in dark mode on `/test-runs/create`
- [x] Verify checkboxes also display correctly in light mode (no regression)

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note priority severity fix and function centralization
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Checkbox icon selector mismatch across PrimeVue versions | Low | Test with actual PrimeVue 4 class names; inspect DOM in browser devtools to confirm correct selectors |

---

## Definition of done

- [x] Priority tags show distinct colors: critical=red, high=orange, medium=blue, low=green
- [x] Priority tags show human-readable labels (Critical, High, Medium, Low) not raw API values
- [x] Colors display correctly on both test cases table and selected cases list on `/test-runs/create`
- [x] No duplicate `getPrioritySeverity` functions remain — single source in `types/testCase.ts`
- [x] Fix applies to all views that display priority (TestRunCreate, TestCaseEditor, TestCaseDetail)
- [x] Checked checkboxes show a visible white checkmark in dark mode
- [x] Checked checkboxes display correctly in light mode (no regression)
- [x] `--primary-color-text` variable defined in both themes
- [x] All quality checks pass (lint, test, build)
