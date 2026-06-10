# Execution Plan: Add Save/Cancel Buttons at Bottom of Edit Test Case Page

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-033-edit-test-case-bottom-save-buttons.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Duplicate the Save Changes and Cancel buttons at the bottom of the edit test case page, and redirect to the test case detail (read-only) view after a successful save.

---

## Context

The edit test case page (`TestCaseEditorView.vue`) has two UX issues:

1. **Save buttons only in the header** (lines 260-270). The page is long — Basic Information, Description, Preconditions, and Test Steps cards stack vertically. After editing steps at the bottom, the user must scroll all the way up to save.
2. **After saving, the user stays on the edit page**. The current `handleSave` resets `hasChanges` but keeps the user in edit mode. The expected flow is: save → redirect to the detail (read-only) view → user can press Edit again if needed. This matches the standard create → view → edit cycle.

---

## Scope

### In scope

- Add a Save Changes + Cancel button pair at the bottom of the page, after the Test Steps card
- Use the same handlers (`handleSave`, `handleCancel`), same loading/disabled state, same role guard
- Match the existing button styling
- After successful save, redirect to the test case detail page (`/test-cases/:id`) so the user lands in read-only view and can press Edit again if needed

### Out of scope

- Sticky header buttons (different UX approach, more complex)
- Keyboard shortcut for save (Ctrl+S — separate accessibility concern)
- "Save and continue editing" option (can be added later if needed)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-cases/TestCaseEditorView.vue` | Add bottom button group; modify `handleSave` to redirect to detail view after success |

### Implementation

**1. Add bottom buttons** after the Test Steps Card (line 446):

```vue
<!-- Bottom action buttons (duplicate of header) -->
<div v-if="authStore.isProjectManager" class="bottom-actions">
  <Button label="Cancel" text @click="handleCancel" />
  <Button
    label="Save Changes"
    icon="pi pi-save"
    :loading="loading"
    :disabled="!hasChanges"
    @click="handleSave"
  />
</div>
```

Add scoped style:

```css
.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
```

**2. Redirect to detail view after save** — modify `handleSave` (line 185). After the success toast, navigate to the detail page:

```ts
// Current (lines 217-218):
originalForm.value = JSON.parse(JSON.stringify(form.value));
hasChanges.value = false;

// Replace with:
hasChanges.value = false;
router.push(`/test-cases/${testCaseId}`);
```

Setting `hasChanges = false` before navigating prevents the "unsaved changes" confirmation dialog from triggering on route leave.

### Key decisions

- **Duplicate, not extract**: Two instances of two buttons is simpler than a shared component. No abstraction needed for two lines of template.
- **Same role guard**: Wrapped in `v-if="authStore.isProjectManager"` to match the header Save button.
- **Right-aligned**: Matches the header button alignment (`justify-content: flex-end`).

---

## Tasks

### Implementation

- [x] Add Save Changes + Cancel buttons after the Test Steps card in `TestCaseEditorView.vue`
- [x] Add `.bottom-actions` scoped style
- [x] Modify `handleSave` to redirect to `/test-cases/:id` (detail view) after successful save
- [x] Set `hasChanges = false` before redirect to avoid "unsaved changes" prompt
- [x] Verify both button pairs work identically (loading state, disabled state, role guard)
- [x] Verify the detail page has an Edit button that navigates back to `/test-cases/:id/edit`

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note bottom save buttons addition
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| "Unsaved changes" dialog triggers on redirect | Low | Set `hasChanges = false` before `router.push` — the `onBeforeRouteLeave` guard checks this flag |
| Detail page missing Edit button | Low | Verify `TestCaseDetailView.vue` has an Edit button; add one if missing |

---

## Definition of done

- [x] Save Changes and Cancel buttons appear at the bottom of the edit page after Test Steps
- [x] Both top and bottom Save buttons trigger the same save action with same loading/disabled behavior
- [x] Both Cancel buttons navigate back
- [x] Buttons only visible to users with `isProjectManager` permission
- [x] After successful save, user is redirected to the test case detail (read-only) view
- [x] No "unsaved changes" prompt appears during the post-save redirect
- [x] Detail page has an Edit button that navigates back to the edit page
- [x] Full cycle works: edit → save → detail (read-only) → edit again
- [x] All quality checks pass (lint, test, build)
