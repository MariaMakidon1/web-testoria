# Execution Plan: Drag-and-Drop Reorder for Sections, Subsections, and Test Cases (TES-69)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Users with the `canManageTests` role can reorder sibling sections in the suite-tree sidebar, sibling subsections inside a section, and sibling test cases inside a section by drag-and-drop. The drag uses native HTML5 events (matching `TestStepsEditor.vue`'s working pattern), shows a clear drop indicator between rows, optimistically reorders the local store on drop, and persists the new order to the backend via a single `PUT` per moved item using a gap-based `display_order` computation. Failures revert the optimistic move and surface an error toast.

Linear: [TES-69](https://linear.app/testoria/issue/TES-69/drag-and-drop-non-functional-in-test-suite-tree) — Bug, Medium. Parent: TES-68. Ref: Alex's POC review 2026-04-28 — BUG-005. API pair: api-testoria plan-046 (adds `display_order` to `test_cases` + suite cycle check).

---

## Context

Today the suite tree has no DnD wiring anywhere. `TestSuiteTree.vue` (the left-sidebar navigator) and `TestCaseSection.vue` (the per-section cases list inside `TestCaseTreeView.vue`) render plain `<div>` rows with no `draggable` attribute, no `@dragstart` / `@dragover` / `@drop` handlers, and no store actions for reorder. `TestStepsEditor.vue` already implements native HTML5 DnD for reordering test steps — same primitive, just confined to one list. That component is the source of the patterns this plan mirrors.

Backend support today:
- **Suites**: `test_suites.display_order` (int | null) exists; `PUT /test-suites/{id}` accepts `display_order` and `parent_suite_id`. Sort is `(display_order NULLS LAST, created_at, id)` already.
- **Cases**: needs api plan-046 to land. Once that ships, cases gain a `display_order` field on Create / Update / Response and the list sort becomes the same `(display_order NULLS LAST, created_at, id)` shape suites already have.

So the FE work is: wire the DnD interactions, mutate the store, fire the PUT, handle rollback. No new endpoints, no new types beyond surfacing the new `display_order` field on `TestCase`.

---

## Scope

### In scope

- **Section (top-level suite) reorder** in the sidebar: drag a top-level section above or below another top-level section. Re-parenting across levels is out of scope for v1.
- **Subsection reorder** within a parent section: drag a subsection above or below a sibling subsection under the same parent. Cross-parent moves stay out of scope.
- **Test case reorder** within a section: drag a case row above or below a sibling case in the same section. Moves between sections stay out of scope (still done via Edit dialog).
- Gap-based `display_order` math on drop:
  - Move to top: `new = first_sibling.display_order - GAP` (or just `-GAP` if first sibling has `null`).
  - Move between A and B: `new = (A.display_order + B.display_order) / 2`, integer-floored.
  - Move to bottom: `new = last_sibling.display_order + GAP`.
  - Initial gap constant `GAP = 1000`.
- Single `PUT /test-suites/{id}` or `PUT /test-cases/{id}` per drop with only `display_order` set.
- Optimistic local reorder on drop; revert + error toast on PUT failure.
- Visual drop indicator: a 2px coloured line at the row's top edge when hovering above the midpoint, bottom edge when below. Drop is rejected (no handler fires) if dropping onto a different parent or sibling group than the dragged item came from — visually shown by a "not-allowed" cursor.
- Role gate: only `canManageTests` users can drag. `draggable` attribute is conditional on the same flag that gates Edit/Delete affordances today.
- Playwright e2e: drag the second section above the first; assert order in the DOM matches; reload and assert the order persists.
- A short readme-level note in `docs/01-product/features/002-suite-tree.md` and the new `docs/01-product/features/003-test-case-authoring.md` section on case reorder.

### Out of scope

- **Cross-parent moves** (section A → child of section B; case → different section). Existing Edit / Move dialogs handle these and the v1 scope is "core interaction primitive", not "complete reorganisation UX". Track as plan-094 follow-up if there's user demand.
- **Multi-select drag.** Reorders one item per drop. Multi-select is a separate plan.
- **Touch DnD on mobile.** The mobile breakpoint hides the suite panel entirely; reorder is a desktop interaction for v1. Future plan can wire `@vueuse/core` `useSortable` or `pointerdown`-based dragging.
- **Keyboard-driven reorder** (Alt + arrow). Different UX surface, follow-up.
- **Auto-scroll while dragging near the viewport edge.** PrimeVue has no built-in primitive; v1 ships without it. Track if the tree gets long enough that it matters.
- **Order-rebalancing routine on the backend.** Tracked as tech debt — gap collapse to `prev + 1` is acceptable for the foreseeable future.
- **Realtime reorder via Centrifugo.** Out of scope until the realtime composable (tech-debt entry) lands.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testSuite.ts` | (already has `display_order`) — verify exported on the tree node shape |
| types | `src/types/testCase.ts` | Add `display_order: number \| null` to `TestCase` |
| api | `src/api/testCases.ts` | No new functions — `updateTestCase` already PUTs arbitrary payloads. Surface `display_order` in the partial-update type |
| stores | `src/stores/testSuites.ts` | New action `reorderSuite(suiteId, newDisplayOrder)` — calls `updateTestSuite`, replaces the suite in the local list, re-sorts. Optimistic with rollback on error |
| stores | `src/stores/testCases.ts` | New action `reorderCase(caseId, newDisplayOrder, suiteId)` — calls `updateTestCase`, replaces the case in `casesBySuite[suite_id]`, re-sorts. Optimistic with rollback |
| composables | `src/composables/useTreeDnd.ts` | Shared `useDnd<T>` returning `{ dragState, onDragStart, onDragOver, onDragLeave, onDrop, dropIndicatorFor }`. Owns the same-parent-only check, the midpoint calculation, and the visual indicator state |
| components | `src/components/test-cases/TestSuiteTree.vue` | Wire `useDnd` on each row; render a 2px `.drop-indicator-top` / `.drop-indicator-bottom`; emit `reorder` event with `(itemId, newOrder)` for the parent to dispatch to the store |
| components | `src/components/test-cases/TestCaseSection.vue` | Same as above for case rows |
| views | `src/views/test-cases/TestCaseListView.vue` | Wire the `reorder` events from both components to `testSuitesStore.reorderSuite` / `testCasesStore.reorderCase` |
| tests | `tests/unit/stores/testCases.spec.ts` (extend) and new `tests/unit/composables/useTreeDnd.spec.ts` | Cover gap math + rollback |
| tests | `tests/e2e/test-cases.spec.ts` | New: section drag, case drag, persistence after reload |

### Key decisions

- **Native HTML5 DnD, not a library.** `TestStepsEditor.vue` already uses native events and works. Pulling in a library (`vuedraggable`, SortableJS, `@vueuse/integrations` Sortable) adds a dependency for a single behaviour. If the same-parent-only constraint relaxes later and we need nested sortables with auto-scroll, revisit then.
- **Extract `useTreeDnd` composable.** Two surfaces use the same DnD logic (`TestSuiteTree`, `TestCaseSection`). Duplicating the dragstart/dragover/drop quartet across both would diverge — extract once, share. Matches the `useCommentSave` extraction pattern noted in tech-debt as the right move for shared multi-step flows.
- **Single PUT per drop, no bulk reorder endpoint.** Gap-based math means a drop touches one row; the rest of the siblings keep their existing `display_order`. Simpler client, simpler API contract, no atomicity concern.
- **Optimistic UI with explicit rollback.** Matches the "no optimistic updates" entry in RELIABILITY.md — except this one *is* optimistic because the alternative is a noticeably laggy drag (PUT round-trip on every drop). Trade-off is documented in this plan's changelog entry; rollback path uses the same store-snapshot pattern as the imports composable.
- **Same-parent constraint enforced in the composable, not just visually.** `onDrop` early-returns if `dragItem.parentKey !== dropItem.parentKey`. Belt-and-braces with the `not-allowed` cursor — visual is a hint, the guard is the contract.
- **Role gate on `draggable` attribute.** A read-only user has no Edit/Delete buttons today; they shouldn't have drag-handles either. The `:draggable="authStore.canManageTests"` binding mirrors the existing UI pattern.
- **`GAP = 1000`.** Big enough that real-world use never collapses; small enough that the integer division converges to `prev + 1` only after ~20 bisects on the same gap. Tracked as tech debt.

---

## Tasks

### Implementation
- [x] `src/types/testCase.ts` — add `display_order: number | null` to `TestCase`
- [x] `src/composables/useTreeDnd.ts` — composable with state + handlers + gap math
- [x] `src/stores/testCases.ts` — `reorderCase` action (optimistic + rollback)
- [x] `src/stores/testSuites.ts` — `reorderSuite` action (optimistic + rollback)
- [x] `src/components/test-cases/TestSuiteTree.vue` — apply `useTreeDnd`; render drop indicators; emit `reorder`
- [x] `src/components/test-cases/TestCaseSection.vue` — apply `useTreeDnd` on case rows; emit `reorder-case`
- [x] `src/views/test-cases/TestCaseListView.vue` — wire `reorder` / `reorder-case` to the store actions

### Tests
- [x] `tests/unit/composables/useTreeDnd.spec.ts` — gap math: top, between, bottom, single-sibling, NULL-sibling
- [x] `tests/unit/stores/testCases.spec.ts` — `reorderCase` PUTs with correct payload; on error reverts local state
- [x] `tests/e2e/test-cases.spec.ts` — drag section #2 above section #1, assert DOM order; reload, assert persistence

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/002-suite-tree.md` — note drag-to-reorder among siblings; cross-parent still via Edit
- [x] `docs/01-product/features/003-test-case-authoring.md` — same note for case rows in a section
- [x] `docs/08-decisions/changelog.md` — plan-093 entry: native DnD primitive, gap-based ordering, optimistic + rollback, scope explicitly excludes cross-parent moves
- [x] `docs/04-execution/tech-debt.md` — add "Cross-parent drag-and-drop (section → section, case → section)" and "Order-rebalance helper when integer gaps collapse"
- [x] `docs/06-generated/api-schema.md` — note `display_order` on the case Update / Response payloads (no new endpoints)
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Native HTML5 DnD has fiddly edge cases (dragend not firing if drop is outside any handler) | Medium | Mirror `TestStepsEditor.vue`'s working sequence verbatim. Reset state on `@dragend` and on the next `@dragstart` |
| Same-parent guard rejects a drop the user expected to work | Low | Document the v1 scope inline (no cross-parent moves); cross-parent has a dedicated Edit path. Cursor + drop indicator reinforce the guard visually |
| Gap math integer-floors to `prev + 1` after enough bisects, hitting a collision | Low | Tracked as tech debt; rebalance helper is the follow-up. In the meantime, a collision on a single PUT is recoverable — the second item lands with the same `display_order` and falls back to the `(created_at, id)` secondary sort |
| Optimistic reorder leaves the UI inconsistent if the PUT fails after another reorder | Low | Rollback uses a captured pre-drop snapshot of `casesBySuite[suite_id]` / `testSuites`; the second reorder operates on the rolled-back state |
| Playwright e2e flake (drag is timing-sensitive) | Medium | Use Playwright's `locator.dragTo` rather than manual mousedown/move/up; assert against a stable `[data-tree-item]` index after the drop |

---

## Definition of done

- [x] A `canManageTests` user can drag a top-level section above/below another top-level section
- [x] A `canManageTests` user can drag a subsection above/below another subsection sharing the same parent
- [x] A `canManageTests` user can drag a case row above/below another case in the same section
- [x] Cross-parent drops are rejected silently (no PUT fires, no UI change)
- [x] On PUT failure, the local order reverts and a toast surfaces the error
- [x] Order persists across page reloads (verified in e2e)
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Feature docs + changelog + tech-debt updated
- [x] TES-69 marked Done in Linear with the merge commit linked
