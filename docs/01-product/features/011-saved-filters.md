# Feature: Saved Filters

## What it does

Saved Filters lets users persist named filter configurations on list views (test cases, test runs) and recall them later. Instead of re-configuring the same filter combination each session, a user can save the current filter state under a name and reapply it with a single click.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Save, apply, and delete filters on any list view |
| **Lead** | Save, apply, and delete filters on their views |
| **Tester** | Save, apply, and delete their own filters |
| **Read Only** | Save and apply filters (read-only views) |

## Key behaviours

- `FilterPanel.vue` provides the filter form; `SavedFiltersDropdown.vue` provides the save/load UI — both are used together on list views.
- Saving a filter captures the current filter state (all active field values) as a named preset.
- Saved filters are stored in **`stores/savedFilters`** and persisted to **`localStorage`** — they survive page reloads.
- Filters are scoped by **view/context key** (e.g. `test-cases`, `test-runs`) — a filter saved on the test cases list is not visible on the test runs list.
- Applying a filter restores all filter fields to the saved values and triggers a fresh data fetch.
- Deleting a saved filter removes it from the dropdown and from `localStorage`.
- Filter names must be unique within the same context; saving with a duplicate name **upserts** (updates filters, isDefault, and updatedAt on the existing entry rather than creating a duplicate).
- The Manage Filters dialog supports **inline rename**: clicking the pencil icon puts the filter name into an editable `InputText` field in-place. `Enter` or blur commits the rename; `Escape` cancels. No separate modal is used.
- Filter names show a **tooltip** with the creation date when hovered in the Manage dialog.

## Constraints / edge cases

- Saved filters are **user-local** — they are stored in `localStorage` on the user's browser, not on the server. They do not sync across devices or users.
- If the filter schema changes (e.g. a new filter field is added), old saved filters with missing fields will apply with partial values — no migration is performed.
- There is no limit enforced on the number of saved filters per context, but very large localStorage entries could cause issues in constrained environments.
- Saved filter names are not sanitised for XSS before rendering — ensure they are rendered as text, not HTML.

## Related docs

- `src/stores/savedFilters.ts`
- `src/components/common/SavedFiltersDropdown.vue`
- `src/components/common/FilterPanel.vue`
- `docs/02-architecture/frontend/state-management.md`
