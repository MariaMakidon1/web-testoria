# Execution Plan: Fix Project Filter Badge Readability

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-034-fix-project-filter-badge-colors.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Fix the `.project-filter-badge` colors so the text is readable in both light and dark mode, and consolidate the duplicated styles into a single shared class.

---

## Context

The project filter badge appears on three pages (Dashboard, Reports, Test Runs) showing which project is selected. It currently uses `background-color: var(--primary-100, #e0e7ff)` with `color: var(--primary-700, #4338ca)`. This combination has poor contrast — especially in dark mode where `--primary-100` and `--primary-700` can resolve to similar tones, making the text nearly invisible. The badge text is not readable.

Additionally, the `.project-filter-badge` style is copy-pasted identically across 3 files (including responsive overrides), which creates maintenance drift.

---

## Scope

### In scope

- Fix badge colors for readable contrast in both light and dark mode
- Extract the duplicated `.project-filter-badge` styles into `main.css` as a shared global class
- Remove the duplicated scoped styles from all 3 view files

### Out of scope

- Changing badge layout, size, or positioning
- Adding filter badges to other pages

---

## Technical approach

### 1. Fix colors

Replace the hardcoded primary palette colors with PrimeVue surface/text tokens that maintain contrast in both themes:

```css
.project-filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background-color: var(--surface-100);
  color: var(--text-color);
  border: 1px solid var(--surface-300);
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 500;
}

.project-filter-badge i {
  font-size: 0.875rem;
  color: var(--primary-color);
}
```

**Rationale:**
- `--surface-100` / `--surface-300` are theme-aware and guaranteed readable in both light and dark mode
- `--text-color` is the standard text color for the current theme
- The folder icon keeps `--primary-color` for a subtle accent
- The `border` adds definition without relying on background-to-text contrast alone

### 2. Consolidate into shared class

Move the style to `src/assets/styles/main.css`. Remove the scoped duplicates from all 3 files. The responsive override (`@media max-width: 768px`) also moves to `main.css`.

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| styles | `src/assets/styles/main.css` | Add `.project-filter-badge` shared class with fixed colors + responsive override |
| views | `src/views/dashboard/DashboardView.vue` | Remove scoped `.project-filter-badge` styles (lines ~573-587, ~809-813) |
| views | `src/views/reports/ReportDashboardView.vue` | Remove scoped `.project-filter-badge` styles (lines ~972-986) |
| views | `src/views/test-runs/TestRunListView.vue` | Remove scoped `.project-filter-badge` styles (lines ~218-232, ~326-329) |

### Key decisions

- **Surface tokens over primary palette**: Surface tokens are designed for backgrounds with text on top — guaranteed readable. Primary palette tokens are accent colors, not meant for bg+text pairs.
- **Global class, not a component**: The badge is a simple `<span>` with a class — doesn't warrant a Vue component. A shared CSS class is the right abstraction level.
- **Keep icon accent color**: The `pi-folder` icon stays `--primary-color` for visual interest while the text uses `--text-color` for readability.

---

## Tasks

### Implementation

- [x] Add `.project-filter-badge` class to `src/assets/styles/main.css` with theme-aware colors
- [x] Add responsive override (`@media max-width: 768px`) for the badge in `main.css`
- [x] Remove scoped `.project-filter-badge` styles from `DashboardView.vue`
- [x] Remove scoped `.project-filter-badge` styles from `ReportDashboardView.vue`
- [x] Remove scoped `.project-filter-badge` styles from `TestRunListView.vue`
- [x] Visual check in light mode: badge text is clearly readable
- [x] Visual check in dark mode: badge text is clearly readable

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note badge color fix and style consolidation
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scoped style removal breaks specificity | Low | Global class has sufficient specificity for a `<span>` element; test all 3 pages |
| Other components accidentally pick up the global class | Very Low | Class name is specific (`.project-filter-badge`); no collisions expected |

---

## Definition of done

- [x] Badge text is clearly readable in light mode
- [x] Badge text is clearly readable in dark mode
- [x] Badge looks consistent across Dashboard, Reports, and Test Runs pages
- [x] No duplicated `.project-filter-badge` styles remain in scoped sections
- [x] All quality checks pass (lint, test, build)
