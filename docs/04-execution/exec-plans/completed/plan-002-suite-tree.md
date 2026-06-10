# Execution Plan: 002 — Suite Tree

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Improve suite tree robustness: persist expand/collapse state, add keyboard navigation within the tree, and guard against the recursive rebuild performance cost for large suite lists.

---

## Context

The suite tree is functionally complete. Analysis identified three gaps: (1) collapsed/expanded state per suite node is not currently persisted — it resets on every page load; (2) keyboard navigation within the tree (arrow keys to move between nodes) is not implemented; (3) the `suiteTree` computed property rebuilds the full nested structure from a flat array on every `testSuites` change — expensive for >200 nodes.

---

## Scope

### In scope
- Persist per-suite expand state in `stores/ui` (keyed by suite ID)
- Add `ArrowUp`/`ArrowDown`/`ArrowRight`/`ArrowLeft` keyboard navigation to `TestSuiteTree.vue`
- Memoize the flat→tree transformation in `testSuitesStore` using a `computed` with stable input reference

### Out of scope
- Drag-and-drop reordering of suites (separate feature)
- Virtual scrolling (deferred — document as tech debt if >500 nodes becomes a real use case)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| store | `src/stores/ui.ts` | Add `suiteExpandedState: Record<number, boolean>` + `toggleSuiteExpand(id)` |
| store | `src/stores/testSuites.ts` | Stabilise `suiteTree` computed to avoid full rebuild when unrelated state changes |
| components | `src/components/test-cases/TestSuiteTree.vue` | Read expand state from `ui` store; add keyboard event handlers (roving tabindex) |
| tests | `tests/unit/stores/testSuites.spec.ts` | New — flat→tree build, expand state persistence |

### Key decisions

- Expand state lives in `stores/ui` (UI-only state rule from CLAUDE.md invariant #5), not in `testSuites`.
- Keyboard navigation uses roving tabindex pattern (one tab stop for the whole tree, arrow keys move within) — consistent with `useAccessibility` composable.

---

## Tasks

### Implementation
- [ ] Add `suiteExpandedState` to `stores/ui`
- [ ] Update `TestSuiteTree.vue` to read/write expand state from `ui` store
- [ ] Add keyboard event handlers (`ArrowUp`, `ArrowDown`, `ArrowRight`, `ArrowLeft`, `Enter`)
- [ ] Optimise `suiteTree` computed in `testSuitesStore`
- [ ] Write unit tests

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/002-suite-tree.md` updated
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Expand state keyed by suite ID becomes stale after suite deletion | Medium | Clear expand state entry on `deleteTestSuite` in `testSuitesStore` |

---

## Definition of done

- [ ] Expand state survives page reload
- [ ] Arrow key navigation moves focus between suite nodes
- [ ] `suiteTree` computed does not rebuild unnecessarily
- [ ] Unit tests passing
