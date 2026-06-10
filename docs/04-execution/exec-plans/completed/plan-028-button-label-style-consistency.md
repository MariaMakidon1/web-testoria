# Execution Plan: Button Label & Style Consistency

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-028-button-label-style-consistency.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Rename "New Suite" to "New Test Suite" on the project detail page, fix its behavior to open an inline "Add Suite" dialog instead of redirecting to the test cases page, and fix all button style inconsistencies across the app to follow a single, documented convention.

---

## Context

The "New Suite" button on `ProjectDetailView.vue` has two problems: (1) it uses a shortened label that doesn't match the "New Test Run" button next to it, and (2) clicking it calls `goToNewSuite()` which navigates to `/projects/{id}/test-cases` — a redirect to the test cases list page that doesn't actually open a suite creation form. The button should instead open an inline "Add Suite" dialog (the same pattern already used in `TestCaseListView.vue` lines ~422-454). Additionally, an audit of all 47 `<Button>` declarations across the app found 8 style inconsistencies: mixed icons for create/save actions, missing icons on empty-state CTAs, and inconsistent use of `text`/`severity` modifiers. Fixing these together ensures a uniform look app-wide.

---

## Scope

### In scope

- Rename "New Suite" → "New Test Suite" in `ProjectDetailView.vue`
- Fix "New Test Suite" button behavior: replace `goToNewSuite()` navigation with an inline "Add Suite" dialog on the project detail page
- Fix all button style inconsistencies (8 issues across 7 files)
- Document the button convention in the design system / component patterns doc

### Out of scope

- Adding new buttons (covered by Plan 026 — delete buttons)
- Removing the Settings button (covered by Plan 027)
- Changing button layout or positioning
- Adding tooltips to icon-only buttons (separate accessibility concern)

---

## Technical approach

### Button convention (to enforce)

| Button type | Style | Icon | Example |
|-------------|-------|------|---------|
| **Primary action** (Create, Submit, Next) | default severity (no attribute) | `pi pi-plus` for create/add, `pi pi-arrow-right` for next | `<Button label="Create Project" icon="pi pi-plus" />` |
| **Save/Confirm** (Save, Update, Apply) | default severity | `pi pi-check` | `<Button label="Save Changes" icon="pi pi-check" />` |
| **Destructive** (Delete) | `severity="danger" text rounded` | `pi pi-trash` | `<Button icon="pi pi-trash" severity="danger" text rounded />` |
| **Cancel/Dismiss** | `text` (no severity) | none | `<Button label="Cancel" text />` |
| **Back/Navigation** | `text` | `pi pi-arrow-left` | `<Button label="Back" icon="pi pi-arrow-left" text />` |
| **Secondary action** (Export, Bulk) | `severity="secondary" text` | contextual | `<Button label="Export CSV" icon="pi pi-download" severity="secondary" text />` |
| **Empty-state CTA** | default severity | `pi pi-plus` | `<Button label="Create your first project" icon="pi pi-plus" />` |

### Changes required

| # | File | Line | Current | Fix |
|---|------|------|---------|-----|
| 1a | `src/views/projects/ProjectDetailView.vue` | 71 | `label="New Suite"` | → `label="New Test Suite"` |
| 1b | `src/views/projects/ProjectDetailView.vue` | 36-38 | `goToNewSuite()` navigates to `/projects/{id}/test-cases` | → replace with inline "Add Suite" dialog (see below) |
| 2 | `src/views/users/UserListView.vue` | ~417 | `"Create"` with `icon="pi pi-check"` | → `icon="pi pi-plus"` |
| 3 | `src/views/test-cases/TestCaseListView.vue` | ~415 | `"Create"` with `icon="pi pi-check"` | → `icon="pi pi-plus"` |
| 4 | `src/views/test-cases/TestCaseEditorView.vue` | ~262 | `"Save Changes"` with `icon="pi pi-save"` | → `icon="pi pi-check"` |
| 5 | `src/components/common/ImportExportDialog.vue` | ~258 | `"Close"` with `severity="secondary"` | → remove severity, add `text` |
| 6 | `src/views/projects/ProjectListView.vue` | ~301 | `"Create your first project"` — no icon | → add `icon="pi pi-plus"` |
| 7 | `src/views/users/UserListView.vue` | ~399 | `"Create a user"` — no icon | → add `icon="pi pi-plus"` |
| 8 | `src/views/users/UserListView.vue` | ~307 | `"Bulk Create"` with `severity="secondary"` — no `text` | → add `text` modifier |

**Fix 1b — "New Test Suite" button behavior in `ProjectDetailView.vue`:**

Replace `goToNewSuite()` with an inline suite creation dialog. Add:
- `showSuiteDialog` ref, `newSuite` ref (`{ name: '', description: '' }`)
- Dialog template (same pattern as `TestCaseListView.vue` lines ~422-454): name input, description textarea, cancel/create footer
- `handleCreateSuite` function: validate name, call `testSuitesStore.createTestSuite(projectId, data)`, show success toast, close dialog
- Import `testSuitesStore` (use `useTestSuitesStore()`)
- Replace `@click="goToNewSuite"` with `@click="showSuiteDialog = true"`
- Remove the `goToNewSuite` function

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `ProjectDetailView.vue` | Rename button label + replace navigation with inline "Add Suite" dialog |
| views | `ProjectListView.vue` | Add icon to empty-state CTA |
| views | `UserListView.vue` | Fix 3 buttons (create icon, empty-state icon, bulk create modifier) |
| views | `TestCaseListView.vue` | Fix create button icon |
| views | `TestCaseEditorView.vue` | Fix save button icon |
| components | `ImportExportDialog.vue` | Fix close button style |
| docs | `docs/03-engineering/patterns/component-patterns.md` | Document button convention table |

### Key decisions

- **`pi-plus` for all create/add actions, `pi-check` for all save/confirm actions**: Clear semantic distinction. Currently mixed — create dialogs use `pi-check` on their submit button, but that's a "create" action, not a "confirm existing" action.
- **Empty-state CTAs get icons**: They are primary actions and should look like primary action buttons, not plain links.
- **Document the convention**: Prevents future drift. Add the convention table to `component-patterns.md` so it's part of the standard reference.

---

## Tasks

### Implementation

- [x] Rename `label="New Suite"` → `label="New Test Suite"` in `ProjectDetailView.vue`
- [x] Replace `goToNewSuite()` navigation with inline "Add Suite" dialog in `ProjectDetailView.vue`: add `showSuiteDialog` ref, `newSuite` ref, dialog template, `handleCreateSuite` handler, import `useTestSuitesStore`
- [x] Fix create button icons: `pi-check` → `pi-plus` in `UserListView.vue` and `TestCaseListView.vue` dialog submit buttons
- [x] Fix save button icon: `pi-save` → `pi-check` in `TestCaseEditorView.vue`
- [x] Fix close button in `ImportExportDialog.vue`: replace `severity="secondary"` with `text`
- [x] Add `icon="pi pi-plus"` to empty-state CTA in `ProjectListView.vue`
- [x] Add `icon="pi pi-plus"` to empty-state CTA in `UserListView.vue`
- [x] Add `text` modifier to "Bulk Create" button in `UserListView.vue`
- [x] Add button convention table to `docs/03-engineering/patterns/component-patterns.md`

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] Visual spot-check: open each affected view and verify buttons render correctly
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/03-engineering/patterns/component-patterns.md` — button convention table added
- [x] `docs/08-decisions/changelog.md` — note button standardization
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Existing unit tests assert on button labels/icons | Low | Search tests for affected labels; update assertions if found |
| Visual regression (button sizing from added icons) | Low | PrimeVue handles icon + label layout consistently; spot-check each view |
| Suite dialog in ProjectDetailView needs testSuitesStore loaded | Low | Ensure `testSuitesStore.fetchTestSuites(projectId)` is called on mount (may already be done); verify store is available |

---

## Definition of done

- [x] "New Suite" reads "New Test Suite" on project detail page
- [x] "New Test Suite" button opens an inline "Add Suite" dialog (not a navigation to test cases page)
- [x] Suite creation via the dialog works: suite appears in the project's suite list
- [x] All create/add buttons use `pi-plus` icon
- [x] All save/confirm buttons use `pi-check` icon
- [x] All cancel/close buttons use `text` modifier (no severity)
- [x] All empty-state CTAs have icons
- [x] All secondary action buttons use `severity="secondary" text`
- [x] Button convention documented in component patterns
- [x] All quality checks pass (lint, test, build)
