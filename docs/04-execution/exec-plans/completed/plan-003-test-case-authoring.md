# Execution Plan: 003 — Test Case Authoring

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Finish the test case authoring UX: implement tag creation and colour management, add an unsaved-changes navigation guard to `TestCaseEditorView`, and cover the store with unit tests.

---

## Context

Analysis confirmed that `Tag` is a typed object (`{ id, name, color }`) linked via `tag_ids`, but the current UI treats tags as free-form strings — there is no way to create new tags with colours or manage the tag library. The `TestCaseEditorView` also lacks a navigation guard (leaving with unsaved changes loses work silently). Unit tests for `testCasesStore` are not yet written.

---

## Scope

### In scope
- Tag management: autocomplete on existing tags, ability to create a new tag inline (name + optional colour), link via `tag_ids`
- Navigation guard on `TestCaseEditorView` using Vue Router `onBeforeRouteLeave` — show `ConfirmDialog` if form is dirty
- Unit tests for `testCasesStore` (fetch, create, update, delete, filter, pagination)

### Out of scope
- Global tag administration UI (manage all tags across a project) — deferred
- Bulk tag operations on test case list — separate feature

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testCase.ts` | No type changes needed — `Tag`, `tag_ids` already defined |
| api | `src/api/tags.ts` | New — `getTags(projectId)`, `createTag(projectId, { name, color })` |
| mock | `src/mock/api/tags.mock.ts` | New — mock implementations |
| store | `src/stores/tags.ts` | New — `tags[]`, `fetchTags(projectId)`, `createTag()` |
| views | `src/views/TestCaseEditorView.vue` | Replace free-form tag input with tag autocomplete+create; add `onBeforeRouteLeave` guard |
| tests | `tests/unit/stores/testCases.spec.ts` | New — full CRUD + filter coverage |

### Key decisions

- Tag creation is inline (within the autocomplete dropdown) — no separate tags management page for now. The `createTag` API call returns the new `Tag` object which is immediately added to the local store and selected.
- Navigation guard triggers only when the form state differs from the originally loaded case (`isDirty` computed comparing serialised form vs original).

---

## Tasks

### Implementation
- [ ] Create `src/api/tags.ts` with `getTags` and `createTag`
- [ ] Create `src/mock/api/tags.mock.ts`
- [ ] Create `src/stores/tags.ts`
- [ ] Update `TestCaseEditorView` — tag autocomplete with inline create
- [ ] Add `onBeforeRouteLeave` dirty-state guard to `TestCaseEditorView`
- [ ] Write `tests/unit/stores/testCases.spec.ts`

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/06-generated/api-schema.md` updated (new `tags` endpoints)
- [ ] `docs/01-product/features/003-test-case-authoring.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Tags API not yet implemented on backend | Medium | Mock layer is complete; feature works in mock mode. Backend endpoint is a separate backend task. |
| Dirty-state detection with Tiptap HTML content | Medium | Normalise HTML strings before comparison (trim whitespace, consistent attribute order) |

---

## Definition of done

- [ ] Tags can be selected from existing tags or created inline with a colour
- [ ] Leaving editor with unsaved changes shows confirmation dialog
- [ ] Unit tests for `testCasesStore` passing
- [ ] Feature works end-to-end in mock mode
