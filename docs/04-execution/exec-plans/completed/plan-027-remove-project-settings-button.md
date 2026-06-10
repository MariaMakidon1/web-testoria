# Execution Plan: Remove Dead Project Settings Button

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-027-remove-project-settings-button.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Remove the non-functional "Settings" button from the project detail view header.

---

## Context

`ProjectDetailView.vue` line 93 renders a `<Button label="Settings" icon="pi pi-cog" outlined />` with no `@click` handler. Clicking it does nothing. There is no project-level settings feature implemented in either the backend or frontend. The button misleads users — especially on newly created projects where they might expect to configure the project. Remove it now; if project settings are needed in the future, a new plan will add both the backend endpoints and the UI together.

---

## Scope

### In scope
- Remove the Settings button from `src/views/projects/ProjectDetailView.vue`

### Out of scope
- Implementing actual project settings (deferred — no backend support exists)
- Removing the global `/settings` route (that is the app-level settings page, unrelated)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/projects/ProjectDetailView.vue` | Remove line 93: `<Button label="Settings" icon="pi pi-cog" outlined />` |

### Key decisions

- **Remove rather than hide**: No point keeping dead code behind a feature flag. Clean removal is simplest.
- **No replacement**: The header already has "New Test Run" and will gain a delete button (Plan 026). No gap in the UI.

---

## Tasks

### Implementation
- [x] Remove the Settings button from `ProjectDetailView.vue`

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)
- [x] `docs/08-decisions/changelog.md` — note removal of placeholder Settings button
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| None — single line removal | N/A | N/A |

---

## Definition of done

- [x] Settings button no longer appears on project detail view
- [x] No dead code left behind (no unused imports, handlers, or styles related to the button)
- [x] All quality checks pass (lint, test, build)
