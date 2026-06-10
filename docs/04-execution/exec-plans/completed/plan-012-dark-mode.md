# Execution Plan: 012 — Dark Mode / Preferences

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Expose the full `UserPreferences` settings in `SettingsView` (currently only partial preferences are configurable via the UI), and ensure the `SettingsView` is wired to `usePreferencesStore` for all documented preference fields.

---

## Context

`usePreferencesStore` defines a rich `UserPreferences` interface with 16 fields across display, table, execution, notification, and editor categories. Only `theme` is toggled from the header. The `SettingsView` exists at `/settings` but its connection to `preferencesStore` is unknown — the route exists but the view content and its preference wiring have not been verified. This plan audits and completes the settings UI.

---

## Scope

### In scope
- Audit `SettingsView` — document which preferences are currently exposed
- Wire all `UserPreferences` fields to the settings UI, grouped by category:
  - **Display**: theme (`light`/`dark`/`system`), compact mode
  - **Table**: default page size, gridlines, striped rows
  - **Execution**: auto-advance, show timer, confirm on status change, default result status
  - **Notifications**: enable notifications, notification duration
  - **Editor**: font size, line numbers, word wrap
- Add a "Reset to defaults" button

### Out of scope
- Server-side preference sync (localStorage only for now)
- Per-project preferences

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/SettingsView.vue` | Read and wire all `UserPreferences` fields; add grouped sections; add Reset button |
| store | `src/stores/preferences.ts` | No changes needed — `setPreference`, `setPreferences`, `resetPreferences` already exist |

### Key decisions

- Settings view uses `v-model` bound to `preferencesStore.preferences` via `setPreference` on change — reactive and auto-persisted via the existing `watch` in the store.
- Theme toggle in `AppHeader` stays as-is for quick access; the settings page provides the full three-option selector.

---

## Tasks

### Implementation
- [ ] Audit current `SettingsView.vue` content
- [ ] Add all preference fields to `SettingsView` in grouped sections
- [ ] Add "Reset to defaults" button wired to `resetPreferences()`
- [ ] Verify dark mode `system` option is selectable (not just light/dark toggle)

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/012-dark-mode.md` updated to reflect full preferences scope
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `SettingsView` may already implement some preferences — audit first to avoid duplication | Medium | Read file before writing |

---

## Definition of done

- [ ] All 16 preference fields are configurable from `SettingsView`
- [ ] Changes persist across page reload
- [ ] "Reset to defaults" restores all fields
- [ ] Theme `system` option is reachable from the UI
