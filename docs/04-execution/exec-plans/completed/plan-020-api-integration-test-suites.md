# Execution Plan: API Integration — Test Suites

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Align test suite types with backend and verify suite tree operations work against the real API.

---

## Context

The test suite API layer (`src/api/testSuites.ts`) is already implemented with all CRUD endpoints. The type differences are minor:

- **Frontend has `display_order`** — backend doesn't have this field
- **Frontend has `child_suites` and `test_case_count`** — these are client-computed from flat list, not returned by backend
- **Backend returns flat list** — client builds tree (correct behavior already)

This is the simplest domain to integrate since the API shape is already very close.

---

## Scope

### In scope
- Remove `display_order` from `TestSuite`, `TestSuiteCreate`, `TestSuiteUpdate` types
- Verify flat-list-to-tree building works with real backend response
- Verify cascade delete behavior
- Test parent_suite_id assignment

### Out of scope
- Drag-and-drop reordering (requires backend `display_order` support)
- Suite move between projects

---

## Tasks

### Implementation
- [x] Review `src/types/testSuite.ts` — separate API types from client-only types
- [x] Verify tree-building logic in store handles real backend flat list
- [x] Update sort to use `name` instead of `display_order`
- [x] Update unit tests for suite tree building
- [x] Fix `TestCaseTreeView` sort reference

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` verified
- [x] This plan moved from `active/` to `completed/`

---

## Definition of done

- [x] Suite CRUD works against real backend
- [x] Tree building from flat list works correctly
- [x] Cascade delete confirmed working
- [x] Unit tests pass
