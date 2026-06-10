# Execution Plan: Edit / Archive / Delete on Project Detail Page (TES-71)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

`ProjectDetailView` (`/projects/:id`) exposes the same project-management actions the list view already has: **Edit** (rename, change description, toggle Archive) for `isProjectManager` (lead+), and **Delete** (with cascade-warning confirmation) for `isAdmin`. The Edit dialog is extracted into a shared `EditProjectDialog` component so the list view and the detail view stay in lockstep on validation, payload shape, and toast copy.

Linear: [TES-71](https://linear.app/testoria/issue/TES-71/no-way-to-edit-archive-or-delete-a-project-all-project-management) — Bug, Medium.

---

## Context

`src/views/projects/ProjectListView.vue` already implements:
- `openEditDialog(project)` (line 76) — opens an inline `<Dialog>` with name/description/archive checkbox; on save calls `projectsStore.updateProject(id, payload)` (handler at lines 120-153).
- `confirmDeleteProject(project)` (line 155) — `useConfirm()` flow → `projectsStore.deleteProject(id)` (lines 166-184). Gated on `authStore.isAdmin` (line 285).

`ProjectDetailView` (`/projects/:id`) renders:
- Page header with **Test Cases**, **New Test Suite**, **New Test Run** buttons.
- Stats cards + project info card (name, description, created date).
- A **Back to Projects** text button.

It exposes **no Edit, Archive, or Delete affordance**. Users can edit/delete from the list (per-row icon buttons), but the detail page — the natural destination after clicking a row — has nothing. The bug report's expected outcome is that the detail page exposes the same management actions.

The fix has two parts:
1. **Extract `EditProjectDialog.vue`** — pulls the inline edit modal out of `ProjectListView` into a reusable component, mirroring the existing `EditTestRunDialog.vue` pattern at `src/components/test-runs/`. Emits `saved` (with updated project) and `update:visible`. Both views consume it.
2. **Add Edit + Delete buttons to `ProjectDetailView`'s header**, with the same role gates the list view uses. Edit opens the shared dialog. Delete uses `useConfirm()` and navigates to `/projects` on success (the project no longer exists; staying on its detail page would 404 on the next refresh).

Backend: nothing to do. `PUT /projects/{id}` and `DELETE /projects/{id}` are both wired and already used by the list view.

---

## Scope

### In scope

- New `src/components/projects/EditProjectDialog.vue`:
  - Props: `visible: boolean`, `project: Project | null`.
  - Emits: `update:visible` (Dialog v-model), `saved(project: Project)` (after successful PUT).
  - Internal: pre-fills name/description/archive from the project prop on each visible→true transition; trims name on submit; disables Save when name is empty or untouched (matches `EditTestRunDialog`'s "no diff = no save" pattern).
  - Calls `projectsStore.updateProject(id, payload)` directly (matches the inline dialog's behaviour); emits success toast on completion via `useToast`.
  - `data-testid` attributes: `edit-project-name`, `edit-project-description`, `edit-project-archived`, `edit-project-save`, `edit-project-cancel`.
- Refactor `src/views/projects/ProjectListView.vue` to use `<EditProjectDialog>` instead of the inline `<Dialog>` markup. Remove `editProject` ref, `openEditDialog`, and `handleUpdateProject` from the view (the dialog owns them). Keep `confirmDeleteProject` / `handleDeleteProject` — delete is one-shot, not worth a component.
- Update `src/views/projects/ProjectDetailView.vue`:
  - Add **Edit** button to the page header, gated `v-if="authStore.isProjectManager"`. `data-testid="project-detail-edit-btn"`.
  - Add **Delete** button to the page header, gated `v-if="authStore.isAdmin"`, `severity="danger"`, `outlined`. `data-testid="project-detail-delete-btn"`.
  - Wire Edit to open `<EditProjectDialog :visible :project="projectsStore.currentProject" @saved="onProjectSaved" />`. After save, refresh `currentProject` (the dialog's own `updateProject` call already mutates the store, so the view re-renders automatically; no extra fetch needed).
  - Wire Delete to `useConfirm()` with the same cascade-warning copy as the list view ("This will also delete all suites, cases, runs, and results"), then call `projectsStore.deleteProject(projectId)`, then `router.push('/projects')`.
  - Import `ConfirmDialog` and add `<ConfirmDialog />` to the template (only Dialog is currently imported).
- Tests:
  - Unit test in `tests/unit/components/EditProjectDialog.spec.ts` (new) — pre-fill, name-required validation, archive checkbox toggles `is_archived`, save emits `saved` with the updated project, save closes the dialog (`update:visible` false). Mirror the existing `EditTestRunDialog.spec.ts` style.
  - Playwright e2e in `tests/e2e/projects.spec.ts` (extending the existing `Show archived` spec): assert the Edit and Delete buttons are visible on the project detail page (admin role) and that clicking Delete + confirming routes to `/projects`.

### Out of scope

- A dedicated `archive`/`unarchive` button on the detail page. The Edit dialog already toggles `is_archived` via the checkbox; same UX as list view. A one-click archive shortcut is a UX improvement, not a bug fix.
- A "Restore" affordance for archived projects. Today the archive flag flips back via the same Edit dialog checkbox. Out of scope.
- A "Soft delete vs hard delete" distinction. Delete uses the existing `DELETE /projects/{id}` (soft-delete, audited). Symmetric with the list view.
- Refactoring the create-project dialog into a shared component too. Smaller win; only the list view creates projects.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/projects/EditProjectDialog.vue` (new) | Extracted from `ProjectListView`'s inline dialog; props/emits/data-testids per scope |
| view | `src/views/projects/ProjectListView.vue` | Drop the inline edit dialog markup + `editProject`/`openEditDialog`/`handleUpdateProject`; mount `<EditProjectDialog>`; row's edit pencil opens it |
| view | `src/views/projects/ProjectDetailView.vue` | Add Edit + Delete header buttons (role-gated); mount `<EditProjectDialog>` + `<ConfirmDialog>`; new handlers `openEdit`, `confirmDelete`, `handleDelete` |
| tests | `tests/unit/components/EditProjectDialog.spec.ts` (new) | Pre-fill, validation, archive toggle, saved emit, close on save |
| tests | `tests/e2e/projects.spec.ts` | Edit + Delete buttons visible on detail page; Delete-then-confirm routes to `/projects` |
| docs | `docs/01-product/features/001-project-management.md` | Note the management actions on the detail page + the shared dialog |
| docs | `docs/02-architecture/ARCHITECTURE.md` (codemap) | Add `EditProjectDialog` row if there's a components section |

### Key decisions

- **Extract the dialog now, not later.** With two consumers (list + detail) the dialog needs to live somewhere shared. `EditTestRunDialog.vue` already established this pattern under `src/components/test-runs/` — mirroring it for projects under `src/components/projects/` keeps the conventions consistent. Without extraction, copy-pasting the dialog into the detail view immediately creates two-source-of-truth drift on validation rules and payload shape (we just had this exact bug in TES-78 with two color systems for "blocked").
- **The dialog owns the `updateProject` call.** Matches `EditTestRunDialog`'s behaviour. The parent listens to `saved` if it needs post-save side-effects (the detail view can use it to optionally refetch stats; the list view doesn't need anything since the store mutation flows into the row automatically).
- **Delete navigates away on success.** Staying on `/projects/:id` after deleting that project is a guaranteed 404 on next refresh — `router.push('/projects')` is the only sensible destination. The list view keeps the user in place because the row just disappears from the list.
- **Same role gates as list view.** Edit = `isProjectManager` (lead+). Delete = `isAdmin`. No new role concepts; aligning with the existing app convention. If a Tester opens the detail page they see no management buttons (unchanged from today, just fewer hidden actions).
- **Cascade-warning copy reused verbatim from the list view's `confirmDeleteProject`.** Identical copy = identical user expectation. Project delete is a hard-impact action; consistent wording is the bug-prevention story.
- **Don't change the list view's per-row delete UX.** Bug TES-71 is about the detail page; per-row delete in the list view already works. Touching it risks regression for no benefit.

---

## Tasks

### Implementation
- [x] Create `src/components/projects/EditProjectDialog.vue` with props/emits/handlers/test-ids per scope
- [x] In `src/views/projects/ProjectListView.vue`: replace the inline edit `<Dialog>` markup with `<EditProjectDialog>`; drop `editProject` ref, `openEditDialog`, `handleUpdateProject`; row pencil button opens the dialog with the row's project
- [x] In `src/views/projects/ProjectDetailView.vue`:
  - [x] Import `ConfirmDialog`, `useConfirm`, `EditProjectDialog`
  - [x] Add `showEditDialog`, `openEdit`, `confirmDelete`, `handleDelete` state/functions
  - [x] Add Edit + Delete buttons in `.header-actions` (Edit before "New Test Run", Delete after — to keep destructive action at the end)
  - [x] Mount `<EditProjectDialog>` and `<ConfirmDialog>` in template

### Tests
- [x] `tests/unit/components/EditProjectDialog.spec.ts` (new) — pre-fill, validation, archive toggle, saved emit, close on save
- [x] `tests/e2e/projects.spec.ts` — extend with detail-page Edit + Delete visibility (admin) and a Delete → confirm → URL flips to `/projects` flow

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/001-project-management.md` — note the detail-page Edit + Delete + Archive (via Edit) actions and the shared `EditProjectDialog` component
- [x] `docs/02-architecture/ARCHITECTURE.md` — codemap row for `EditProjectDialog` if the codemap lists components
- [x] `docs/08-decisions/changelog.md` — plan-091 entry: extract `EditProjectDialog`, add detail-page management actions
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| The list view's existing edit/delete tests break when we refactor | Medium | Update them to the new `<EditProjectDialog>` test-ids; the existing tests already use `data-testid` so the surface is small. The list view's e2e (TES-82's archive flow) uses `id="edit-archived"` — those need to be migrated to the new dialog's data-testids |
| `EditProjectDialog` v-model doesn't sync correctly when the parent prop changes | Low | Watch `() => props.project` to reset the form on each new project / each visible→true transition. Mirror `EditTestRunDialog`'s pattern verbatim |
| Detail page's Delete confirms then errors (e.g., backend rejects delete on a project with active runs) | Low | Existing list view's `handleDeleteProject` already has the toast-on-error path; the same one is reused. If backend adds a constraint later, both views surface it identically |
| Detail page's role gates show Delete but list view's per-row Delete is hidden (or vice versa) | Low | Same gates verbatim (`isProjectManager`, `isAdmin`) — the entire point of using the same flags |
| User clicks Edit on the detail page, archives, saves; the global project selector in the navbar still shows the now-archived project | Low | `AppHeader.vue:23` filters `!p.is_archived` in its dropdown; after the store update propagates the navbar refreshes. Verified during planning |

---

## Definition of done

- [x] **Edit** button visible in the project detail header for `isProjectManager` (lead+) users
- [x] **Delete** button visible in the project detail header for `isAdmin` users
- [x] Clicking Edit opens the shared `EditProjectDialog` pre-filled with the project's current name/description/is_archived
- [x] Saving the dialog updates the project on the backend, closes the dialog, surfaces a success toast, and the page reflects the changes
- [x] Clicking Delete shows the cascade-warning confirmation; confirming deletes the project and navigates to `/projects`
- [x] List view continues to work (per-row Edit + Delete unchanged)
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Unit tests cover the new dialog component
- [x] Playwright e2e covers the detail-page actions
- [x] Feature doc + changelog updated
- [x] TES-71 marked Done in Linear with the merge commit linked
