# Execution Plan: Add Test Steps Editor to Create Test Case Dialog

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-029-test-steps-in-create-dialog.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Add the `TestStepsEditor` component to the "Create Test Case" dialog so users can define test steps during creation, matching the functionality already available on the edit page.

---

## Context

The edit page (`/test-cases/:id/edit`) includes a full `TestStepsEditor` with add, remove, reorder, and duplicate capabilities. The create dialog in `TestCaseListView.vue` only captures title, suite, priority, type, status, description, and preconditions — steps are initialized as an empty array `[]` and not editable. Users must create a test case first, then navigate to the edit page to add steps. This is a friction point: steps are a core part of a test case and should be definable at creation time.

No backend changes are needed — the `TestCaseCreate` schema already accepts `steps: TestStep[]` and the API function sends the full payload. The store passes steps through unchanged. This is a frontend-only change.

---

## Scope

### In scope

- Integrate `TestStepsEditor` component into the create test case dialog in `TestCaseListView.vue`
- Bind steps data to `newTestCase.steps` (already initialized as `[]`)
- Ensure the dialog is scrollable / large enough to accommodate the steps editor
- Steps are optional on create — the editor starts empty, user can add steps or skip

### Out of scope

- Tags editor in create dialog (separate concern, edit-only for now)
- Backend changes (not needed — API already accepts steps on create)
- Modifying `TestStepsEditor` component itself (already works standalone)
- Converting the dialog to a full page (keep it as a dialog)

---

## Technical approach

The `TestStepsEditor` component is already self-contained — it takes a `v-model` of `TestStep[]` and handles all CRUD/reorder internally. Integration is straightforward: import the component, add it to the dialog template, and bind it to `newTestCase.steps`.

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-cases/TestCaseListView.vue` | Import `TestStepsEditor`, add it to the create dialog below the preconditions field, adjust dialog width/scroll |

### Implementation detail

In `TestCaseListView.vue`:

1. **Import**: Add `import TestStepsEditor from '@/components/test-cases/TestStepsEditor.vue'`
2. **Template**: Add the steps editor after the preconditions textarea inside the create dialog:
   ```vue
   <div class="field">
     <label>Test Steps</label>
     <TestStepsEditor v-model="newTestCase.steps" />
   </div>
   ```
3. **Dialog sizing**: Add `style="width: 50rem"` or increase existing dialog width to give the steps editor enough room. Add `class="overflow-y-auto"` with a max-height on the dialog content if it becomes too tall.
4. **Reset**: `newTestCase.steps` is already reset to `[]` on dialog close — no change needed.

### Key decisions

- **Keep the dialog format (not convert to full page)**: The create dialog is quick and lightweight. Adding steps doesn't justify a page navigation. If the dialog becomes too complex in the future, converting to a page can be a separate plan.
- **Steps section is collapsible or at the bottom**: Place below preconditions so the basic fields remain prominent. The editor starts empty (0 steps) so it doesn't add much visual weight by default.
- **No minimum step requirement**: Steps remain optional. Some test cases are created as placeholders and fleshed out later.

---

## Tasks

### Implementation

- [x] Import `TestStepsEditor` into `TestCaseListView.vue`
- [x] Add `TestStepsEditor` bound to `newTestCase.steps` in the create dialog template
- [x] Adjust dialog width/scroll to accommodate the steps editor
- [x] Verify steps are included in the create payload (already the case — confirm no regression)
- [x] Test: create a test case with steps → navigate to edit page → verify steps are persisted

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)

- [x] `docs/01-product/features/` — update test case authoring feature doc to note steps are available at creation time
- [x] `docs/08-decisions/changelog.md` — note addition of steps editor to create dialog
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dialog becomes too tall on small screens | Medium | Set max-height with overflow-y scroll on dialog content; test at 768px viewport |
| Steps editor styles conflict inside dialog | Low | TestStepsEditor is already self-contained with scoped styles; spot-check visually |

---

## Definition of done

- [x] Create test case dialog includes the `TestStepsEditor` component
- [x] Users can add, remove, reorder, and duplicate steps during test case creation
- [x] Steps are persisted to the backend when the test case is created
- [x] Steps appear correctly on the edit page after creation
- [x] Dialog is usable on standard screen sizes (no overflow/clipping)
- [x] Creating a test case with zero steps still works (no regression)
- [x] All quality checks pass (lint, test, build)
