# Execution Plan: API Integration — Projects

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Align project types and API calls with backend and verify all project endpoints work against the real API.

---

## Context

The project API layer (`src/api/projects.ts`) is already implemented. However, there are **type mismatches**:

- **Frontend `Project` has `key` and `created_by`** — backend doesn't have these fields
- **Frontend `ProjectCreate` has `key`** — backend doesn't accept this
- **`getProjects()` sends `include_archived`** — backend uses `archived` filter param
- **`getProjects()` returns `Project[]`** — backend returns paginated `{ items, total, page, page_size, total_pages }`

---

## Scope

### In scope
- Remove `key` and `created_by` from `Project` type (or make optional if needed for display)
- Fix `getProjects()` to handle paginated response from backend
- Fix query param names to match backend
- Add pagination support to project list
- Verify `getProjectStats()` response matches `ProjectStats` type

### Out of scope
- Project archive/unarchive UI improvements
- Custom fields on projects (Phase 8 feature)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/project.ts` | Remove `key`, `created_by` from `Project`; remove `key` from `ProjectCreate`; add `ProjectStats.total_test_suites` |
| api | `src/api/projects.ts` | Fix `getProjects` to accept pagination params and return `PaginatedResponse<Project>`; fix `archived` param name |
| store | `src/stores/projects.ts` | Handle paginated response, add pagination state |
| views | Project list view | Remove key column and key form field |
| components | Any component referencing `project.key` | Replace with `project.name` |

### Key decisions

- **`key` field**: The backend doesn't have project keys. Remove from types entirely — if a short identifier is needed, use `id`.
- **Pagination**: Backend always returns paginated responses for lists. Frontend must send `page` + `page_size` params.

---

## Tasks

### Implementation
- [x] Update `src/types/project.ts` — remove `key`, `created_by`; ensure `ProjectStats` matches backend
- [x] Update `src/api/projects.ts` — `getProjects()` accepts `{ archived?: boolean, page?: number, page_size?: number }` and returns `PaginatedResponse<Project>`
- [x] Update `src/stores/projects.ts` — add pagination state, handle paginated response
- [x] Search for `project.key` and `project.created_by` references in components/views and update
- [x] Verify `getProjectStats` response matches backend's `{total_test_cases, total_test_suites, total_test_runs, pass_rate}`
- [x] Write/update unit tests for projects store

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated
- [x] `docs/01-product/features/projects.md` updated (if exists)
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Components rely on `project.key` for display | Medium | Grepped for `.key` usage — fixed in views and composables |
| Pagination changes break existing project list UI | Low | Tested build + all tests pass |

---

## Definition of done

- [x] Project types match backend schema exactly
- [x] CRUD works against real backend
- [x] Project list supports pagination
- [x] No references to removed fields remain
- [x] Unit tests pass
