# Execution Plan: Delete & Restore UI for All Entities

**Date**: 2026-04-08
**Author**: Claude
**Status**: Phase A complete (2026-04-13). Phase B deferred — blocked on backend api-testoria plan-020.

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-026-delete-buttons-soft-delete-ui.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Add delete button actions (with confirmation) to all entity views, and integrate with the backend soft-delete system by adding restore buttons, "show deleted" toggles, and deleted-state visual indicators.

---

## Context

The backend is implementing soft delete for all major entities (Plan 020 in api-testoria). Currently the frontend has delete buttons only for **Projects** and **Users**. Test Cases, Test Runs, Test Suites, and Milestones have API functions and store actions for delete but no UI to trigger them. This plan adds the missing delete buttons and also updates all entities to work with the new soft-delete backend: showing `deleted_at` state, filtering deleted items, and restoring soft-deleted entities.

**Depends on**: `api-testoria` Plan 020 (soft delete backend) — the soft-delete/restore portions of this plan require the backend changes to be deployed. Delete buttons for the four missing entities can be implemented immediately against the existing hard-delete backend.

---

## Scope

### In scope

**Phase A — Missing delete buttons (no backend dependency)**
- Add delete button + confirmation dialog to **TestCaseListView** / **TestCaseDetailView**
- Add delete button + confirmation dialog to **TestRunListView** / **TestRunDetailView**
- Add delete button + confirmation dialog to **TestSuiteTree** (context menu or action icon)
- Add delete button + confirmation dialog to milestone list (within **ProjectDetailView** or dedicated view)
- Role-based visibility: delete buttons visible only to users with appropriate permissions
- Success toast + list refresh after deletion
- Error handling (409 conflict, 404 not found, cascade warnings)

**Phase B — Soft-delete integration (requires backend Plan 020)**
- Add `deleted_at` field to all relevant TypeScript types
- Add `restoreProject`, `restoreTestSuite`, `restoreTestCase`, `restoreTestRun`, `restoreMilestone` API functions
- Add restore store actions for all entities
- Add `include_deleted` query parameter support to list API functions and store fetch actions
- Add "Show deleted" toggle (checkbox/switch) to list views for Projects, Test Cases, Test Runs, Milestones
- Visual indicator for soft-deleted items (strikethrough text, muted row, "Deleted" badge)
- Restore button on soft-deleted items (with confirmation)
- Error handling: 400 "restore parent first" shown as informative toast
- Update bulk operations composable to support bulk soft-delete

### Out of scope

- Purge / permanent delete UI (deferred — admin tool)
- Trash/recycle-bin view (deferred — nice-to-have)
- Soft-delete for tags (backend keeps hard delete)
- Undo toast with auto-restore timer (deferred)

---

## Technical approach

### Phase A — Delete buttons

Follow the established pattern from `ProjectListView.vue` and `UserListView.vue`:

```vue
<!-- Pattern: PrimeVue useConfirm() + toast -->
function confirmDelete(item: Entity) {
  confirm.require({
    message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
    header: 'Delete Entity',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => handleDelete(item.id),
  })
}

async function handleDelete(id: number) {
  try {
    await store.deleteEntity(id)
    toast.add({ severity: 'success', summary: 'Deleted', detail: '...', life: 3000 })
  } catch (error) {
    toast.add({ severity: 'error', summary: 'Error', detail: '...', life: 5000 })
  }
}
```

**Delete button placement per entity:**

| Entity | View | Button location | Permission guard |
|--------|------|----------------|------------------|
| Test Suite | `TestSuiteTree.vue` | Action icon (trash) next to suite name, visible on hover | `authStore.canManageTests` |
| Test Case | `TestCaseListView.vue` | Action column in DataTable (matches project pattern) | `authStore.canManageTests` |
| Test Case | `TestCaseDetailView.vue` | Header action button (danger variant) | `authStore.canManageTests` |
| Test Run | `TestRunListView.vue` | Action column in DataTable | `authStore.canManageTests` |
| Test Run | `TestRunDetailView.vue` | Header action button (danger variant) | `authStore.canManageTests` |
| Milestone | `ProjectDetailView.vue` (milestones section) | Action icon in milestone list/table | `authStore.isProjectManager` |

**Cascade warning messages:**
- Deleting a **project**: "This will also delete all suites, test cases, runs, and results in this project."
- Deleting a **test suite**: "This will also delete all test cases in this suite and its child suites."
- Deleting a **test run**: "This will also delete all results in this run."
- Deleting a **test case**: Standard message (no cascade).
- Deleting a **milestone**: Standard message (runs will have milestone unlinked).

### Phase B — Soft-delete integration

**1. Types update** — Add to all entity interfaces:
```ts
deleted_at: string | null  // ISO datetime or null
```

**2. API functions** — Add per entity:
```ts
// api/projects.ts
export function restoreProject(id: number): Promise<ProjectResponse> {
  return apiClient.post(`/projects/${id}/restore`)
}

// Existing list function gains include_deleted param
export function getProjects(params: { ..., include_deleted?: boolean })
```

**3. Store actions** — Add per entity:
```ts
async function restoreProject(id: number) {
  const restored = await projectsApi.restoreProject(id)
  // Update item in list (replace deleted version with restored)
  const idx = projects.value.findIndex(p => p.id === id)
  if (idx !== -1) projects.value[idx] = restored
}
```

**4. "Show deleted" toggle** — Add to list view toolbars:
```vue
<div class="flex align-items-center gap-2">
  <Checkbox v-model="showDeleted" :binary="true" inputId="show-deleted" />
  <label for="show-deleted">Show deleted</label>
</div>
```

Toggle triggers store re-fetch with `include_deleted: true`.

**5. Visual indicators for deleted items:**
- Row class: `{ 'row-deleted': item.deleted_at }` → CSS: opacity 0.5, italic text
- Badge: `<Tag severity="danger" value="Deleted" />` in the status column
- Delete button hidden, replaced by Restore button: `<Button icon="pi pi-replay" label="Restore" />`

**6. Restore flow:**
```ts
async function handleRestore(id: number) {
  try {
    await store.restoreEntity(id)
    toast.add({ severity: 'success', summary: 'Restored', detail: '...', life: 3000 })
  } catch (error: any) {
    if (error.response?.status === 400) {
      toast.add({ severity: 'warn', summary: 'Cannot Restore', detail: 'Parent entity is deleted. Restore it first.', life: 5000 })
    }
  }
}
```

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/project.ts`, `testCase.ts`, `testRun.ts`, `testSuite.ts`, `milestone.ts`, `user.ts` | Add `deleted_at: string \| null` to response interfaces |
| api | `src/api/projects.ts`, `testCases.ts`, `testRuns.ts`, `testSuites.ts`, `milestones.ts` | Add `restore*()` functions; add `include_deleted` param to list functions |
| stores | `src/stores/projects.ts`, `testCases.ts`, `testRuns.ts`, `testSuites.ts`, `milestones.ts` | Add `restore*()` actions; add `showDeleted` state + fetch logic |
| views | `src/views/test-cases/TestCaseListView.vue`, `TestCaseDetailView.vue` | Delete button, confirm, restore button, "show deleted" toggle |
| views | `src/views/test-runs/TestRunListView.vue`, `TestRunDetailView.vue` | Delete button, confirm, restore button, "show deleted" toggle |
| views | `src/views/projects/ProjectListView.vue` | Update existing delete for soft-delete messaging, add restore + "show deleted" toggle |
| views | `src/views/projects/ProjectDetailView.vue` | Milestone delete/restore buttons |
| components | `src/components/test-cases/TestSuiteTree.vue` | Delete action icon on suites, restore icon for deleted suites |
| styles | `src/assets/styles/main.css` | `.row-deleted` style (opacity, italic) |
| tests | `src/tests/` | Unit tests for delete/restore flows |

### Key decisions

- **Use PrimeVue `useConfirm()` (not custom ConfirmDialog)**: Matches existing project/user pattern. Simpler, less boilerplate. The custom `ConfirmDialog.vue` is available but not used by current delete flows.
- **Cascade warnings in confirmation message**: Users must understand what will be deleted. Warning text varies per entity type.
- **"Show deleted" as a list-level toggle, not a global setting**: Different list views may have independent needs. State lives in the store per domain, not in `ui` store.
- **Restore requires explicit action, no auto-restore of children**: Matches backend design (Plan 020). Safer — user restores what they need.
- **Phase A is independent of Phase B**: Delete buttons can ship against the current hard-delete backend. Soft-delete UI is additive when backend is ready.

---

## Tasks

### Phase A — Delete buttons (no backend dependency)

- [x] Add delete button + confirmation to `TestCaseListView.vue` (hover-reveal icon per row in `TestCaseSection`, since the list view uses a tree rather than a DataTable)
- [x] Add delete button + confirmation to `TestCaseDetailView.vue` (header action)
- [x] Add delete button + confirmation to `TestRunListView.vue` (action column in DataTable)
- [x] Add delete button + confirmation to `TestRunDetailView.vue` (header action)
- [x] Add delete button + confirmation to `TestSuiteTree.vue` (hover action icon per suite node) — plus section header delete in `TestCaseSection.vue`
- [ ] Add delete button + confirmation to milestone list in `ProjectDetailView.vue` — **deferred**: no milestone list UI exists yet
- [x] Add cascade warning messages to Project, TestSuite, and TestRun delete confirmations
- [x] Verify role guards: delete visible only for `canManageTests` (cases/suites/runs)
- [x] Handle error responses (404, 409) with appropriate toast messages
- [x] Navigate away from detail view after deleting the viewed entity (redirect to list)

### Phase B — Soft-delete integration (after backend Plan 020)

- [ ] Add `deleted_at: string | null` to TypeScript interfaces for Project, TestSuite, TestCase, TestRun, TestResult, Milestone, User
- [ ] Add `restoreProject()`, `restoreTestSuite()`, `restoreTestCase()`, `restoreTestRun()`, `restoreMilestone()` to API layer
- [ ] Add `include_deleted` param to list API functions (`getProjects`, `getTestCases`, `getTestRuns`, `getTestSuites`, `getMilestones`)
- [ ] Add `showDeleted` ref + `restore*()` actions to each store
- [ ] Add "Show deleted" checkbox toggle to `ProjectListView`, `TestCaseListView`, `TestRunListView`
- [ ] Add `.row-deleted` CSS class (opacity 0.5, italic, muted text)
- [ ] Conditionally render Restore button (instead of Delete) for soft-deleted items in all list views
- [ ] Add `<Tag severity="danger" value="Deleted" />` badge for soft-deleted items in DataTable rows
- [ ] Handle 400 "restore parent first" error with informative toast
- [ ] Update confirmation messages: "delete" → "This item can be restored later" (softer messaging)
- [ ] Update bulk operations composable to support bulk soft-delete if applicable

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (281 tests)
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [ ] `docs/06-generated/api-schema.md` — add restore functions, update list functions with `include_deleted`
- [ ] `docs/01-product/features/` — create or update soft-delete feature doc
- [ ] `docs/02-architecture/ARCHITECTURE.md` — update codemap if new composable or component added
- [ ] `docs/08-decisions/changelog.md` — record useConfirm vs ConfirmDialog decision, cascade warnings, phase split
- [ ] `docs/04-execution/tech-debt.md` — add trash/recycle-bin view as future item
- [ ] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Phase B blocked by backend Plan 020 delay | Medium | Phase A ships independently with no backend changes; Phase B is additive |
| Accidental delete without confirmation | Low | All deletes go through PrimeVue `useConfirm()` — no direct call paths |
| Suite tree delete UX is awkward (tree nodes are small) | Medium | Use hover-reveal icon + right-click context menu as fallback; test with real data |
| Cascade delete surprises users | Medium | Explicit cascade warning in confirmation message; soft-delete makes it recoverable |
| Stale list data after delete (other tabs) | Low | Each delete action triggers local array filter; full re-fetch on next navigate |

---

## Definition of done

- [ ] Delete button works for all six entity types (Project, TestSuite, TestCase, TestRun, Milestone, User)
- [ ] Every delete shows a confirmation dialog before proceeding
- [ ] Cascade entities are mentioned in confirmation message (project → suites/cases, suite → cases, run → results)
- [ ] Delete buttons respect role permissions (not visible to unauthorized roles)
- [ ] Success and error toasts display after delete
- [ ] Detail views navigate to list after deleting the viewed entity
- [ ] (Phase B) Soft-deleted items display with visual indicator when "Show deleted" is on
- [ ] (Phase B) Restore button works and shows success toast
- [ ] (Phase B) "Restore parent first" error handled gracefully
- [ ] Unit tests cover delete and restore flows
- [ ] All quality checks pass (lint, test, build)
- [ ] Docs updated
