# Execution Plan: Create Suite From New Test Case Dialog

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-030-create-suite-from-test-case-dialog.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Allow users to create a new test suite inline from the "Create Test Case" dialog, reusing the existing "Add Section" dialog and logic already in `TestCaseListView.vue`.

---

## Context

The "Create Test Case" dialog has a suite dropdown (`Select`) that only lists existing suites — if the suite the user needs doesn't exist yet, they must close the dialog, create the suite separately via the "Add Section" flow, then reopen the create dialog and select it. The "Add Section" dialog and its `handleCreateSuite` logic are already implemented in the same file (`TestCaseListView.vue`, lines ~422-454). The fix is to add a "New Suite" button next to the suite dropdown that opens the existing suite creation dialog and auto-selects the newly created suite.

No backend or API changes needed — `POST /projects/{id}/test-suites` already exists and the store action works.

---

## Scope

### In scope

- Add a "New Suite" button/link next to the suite `Select` in the create test case dialog
- Reuse the existing `showSuiteDialog` / `handleCreateSuite` flow
- After suite creation, auto-select the new suite in the test case form
- Suite options list updates automatically (already computed from store)

### Out of scope

- Adding the same capability to the edit page suite selector (separate concern, can be a follow-up)
- Nested suite creation (parent suite picker) — the quick-create makes a root-level suite; hierarchy managed via the suite tree
- Backend changes (not needed)

---

## Technical approach

Everything needed is already in `TestCaseListView.vue`. The implementation adds a button and a small callback.

### Changes

1. **Add "New Suite" button** next to the suite `Select` in the create dialog (lines ~326-335). Wrap the Select + button in a flex row:

   ```vue
   <div class="field">
     <label for="case-suite">Test Suite *</label>
     <div class="flex gap-2">
       <Select
         id="case-suite"
         v-model="newTestCase.suite_id"
         :options="suiteOptionsForForm"
         optionLabel="label"
         optionValue="value"
         placeholder="Select suite"
         class="flex-1"
       />
       <Button
         v-if="authStore.isProjectManager"
         icon="pi pi-plus"
         v-tooltip="'New Suite'"
         outlined
         @click="handleQuickCreateSuite"
       />
     </div>
   </div>
   ```

2. **Add `handleQuickCreateSuite` function** that opens the existing suite dialog with a flag to auto-select after creation:

   ```ts
   const autoSelectSuiteAfterCreate = ref(false)

   function handleQuickCreateSuite() {
     autoSelectSuiteAfterCreate.value = true
     handleAddSuite(null) // opens existing suite dialog with no parent
   }
   ```

3. **Modify `handleCreateSuite`** to auto-select the new suite when the flag is set:

   ```ts
   // After successful creation, inside the existing try block:
   const created = testSuitesStore.testSuites.at(-1) // newly added
   if (autoSelectSuiteAfterCreate.value && created) {
     newTestCase.value.suite_id = created.id
     autoSelectSuiteAfterCreate.value = false
   }
   ```

   Note: The store's `createTestSuite` action pushes the new suite to the array, so the latest entry is the one just created. If the store returns the created suite from the action, use that directly instead.

4. **No dialog stacking issues** — PrimeVue `Dialog` supports multiple modals. The suite dialog opens on top of the test case dialog. When the suite dialog closes, the test case dialog is still open with the suite now selected.

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-cases/TestCaseListView.vue` | Add "New Suite" button next to suite Select, add `autoSelectSuiteAfterCreate` ref, modify `handleCreateSuite` to auto-select |

### Key decisions

- **Reuse existing dialog, don't duplicate**: The suite creation dialog and handler already exist in the same file. Adding a trigger + auto-select flag is minimal code.
- **Icon-only button with tooltip**: Keeps the form compact. `pi-plus` icon + "New Suite" tooltip matches the button conventions (Plan 028).
- **Role guard**: Only `isProjectManager` can create suites — matches existing guard on the "Add Section" trigger.
- **Root-level suite only**: The quick-create makes a root suite (`parent_suite_id: null`). Nesting can be done later via the suite tree. Keeps the flow simple.

---

## Tasks

### Implementation

- [x] Wrap suite `Select` + new button in a flex row in the create test case dialog
- [x] Add `autoSelectSuiteAfterCreate` ref
- [x] Add `handleQuickCreateSuite` function that sets the flag and opens the suite dialog
- [x] Modify `handleCreateSuite` to auto-select the new suite in `newTestCase.suite_id` when flag is set
- [x] Verify dialog stacking works (suite dialog over test case dialog)
- [x] Test: open create test case → click "+" → create suite → suite auto-selected → complete test case creation

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/01-product/features/` — update test case authoring feature doc to note inline suite creation
- [x] `docs/08-decisions/changelog.md` — note reuse of existing suite dialog via flag pattern
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dialog stacking z-index conflict | Low | PrimeVue manages z-index for stacked modals; test visually |
| Suite list doesn't update after create | Low | `suiteOptionsForForm` is a computed from `testSuitesStore.testSuites` — auto-updates when store changes |
| Auto-select picks wrong suite if concurrent edits | Very Low | Single-user flow; store push order is deterministic. Use returned suite object if available |

---

## Definition of done

- [x] "New Suite" button appears next to the suite dropdown in the create test case dialog
- [x] Button is only visible to users with `isProjectManager` permission
- [x] Clicking the button opens the existing "Add Section" dialog
- [x] After creating the suite, the new suite is auto-selected in the test case form
- [x] Suite dropdown options update immediately to include the new suite
- [x] Test case creation completes successfully with the newly created suite
- [x] Dialog stacking works correctly (no visual glitches)
- [x] All quality checks pass (lint, test, build)
