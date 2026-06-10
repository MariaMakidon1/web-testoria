# Execution Plan: 011 — Saved Filters

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Enforce filter name uniqueness per context, add a rename action to the dropdown, and display `createdAt` / `updatedAt` timestamps in the filter list tooltip.

---

## Context

Analysis found that `savedFiltersStore` appends a new filter entry even if a filter with the same name already exists in the same context — the feature doc says names must be unique but the code does not enforce this. The `SavedFilter` type has `createdAt` and `updatedAt` fields that are populated but never shown. No rename action exists — users must delete and recreate to rename a filter.

---

## Scope

### In scope
- Enforce name uniqueness per context in `savedFiltersStore.saveFilter`: if a filter with the same name exists in the same context, overwrite it (upsert semantics) rather than appending a duplicate
- Show `createdAt` in a `v-tooltip` on each entry in `SavedFiltersDropdown`
- Add a rename action (inline edit or dialog) to the dropdown item menu

### Out of scope
- Server-side filter persistence (localStorage only)
- Sharing saved filters between users

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| store | `src/stores/savedFilters.ts` | Change `saveFilter` to upsert: find existing by `name + context`, update if found, append if not |
| components | `src/components/common/SavedFiltersDropdown.vue` | Add `createdAt` tooltip on each item; add rename action in item overflow menu |

### Key decisions

- Upsert on name collision updates `filters` and `updatedAt` on the existing entry rather than changing the ID — this preserves any future references by ID.
- Rename uses inline editing (click-to-edit the name in the dropdown) rather than a dialog — simpler UX for a short text field.

---

## Tasks

### Implementation
- [ ] Update `saveFilter` in `savedFiltersStore` to upsert by `name + context`
- [ ] Add `createdAt` tooltip to dropdown items
- [ ] Add rename inline edit to dropdown items

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/011-saved-filters.md` updated (name uniqueness now enforced, rename documented)
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Existing users have duplicate-named filters in localStorage | Low | Upsert logic only applies to new saves — existing duplicates are not auto-merged. Acceptable for now. |

---

## Definition of done

- [ ] Saving a filter with a name that already exists updates the existing entry (no duplicate)
- [ ] Each filter entry shows creation date in tooltip
- [ ] Users can rename a saved filter inline
