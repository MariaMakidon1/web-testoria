# Execution Plan: Fix "Show Archived" Checkbox on Projects Page (TES-82)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Toggling the **"Show archived"** checkbox on `/projects` actually changes the list: archived projects appear when checked, disappear when unchecked. Same query-param contract as the rest of the app (`include_archived`, matching backend and `ProjectStatsBulkParams`).

Linear: [TES-82](https://linear.app/testoria/issue/TES-82/show-archived-checkbox-does-nothing-on-projects-page) — Bug, Medium.

---

## Context

Two compounding defects make the checkbox a no-op today:

1. **Wrong query-param name in the API client.** `src/api/projects.ts:12-16` defines `ProjectFilters` with `archived?: boolean`, and `getProjects` forwards the filter object verbatim to axios as query params. The backend (`api-testoria/app/api/v1/projects.py:31`) expects `include_archived: bool` (default `false`). So even if the view sent `{ archived: true }`, the backend would still default to `is_archived=false` and exclude archived projects. The bulk-stats endpoint client (`ProjectStatsBulkParams.include_archived`) already uses the correct name — the inconsistency is local to `ProjectFilters`.

2. **The view never re-fetches when the toggle changes.** `src/views/projects/ProjectListView.vue:69-71` calls `projectsStore.fetchProjects()` once on mount with no filters. The `showArchived` ref (line 28) is only read by a client-side `computed` filter (lines 51-54) that strips `is_archived` rows from the in-memory list. Because the backend never returned archived projects in the first place, that filter has no effect on the visible row count.

Backend already supports `?include_archived=true` (verified in `app/services/project_service.py:39-59` and integration test `tests/integration/test_projects_api.py:444-474`); no api-testoria change is needed.

Other consumers of `projectsStore.projects` filter `!p.is_archived` themselves before rendering (`src/components/common/AppHeader.vue:23`, `src/views/test-runs/TestRunCreateView.vue:60`, `src/composables/usePassRateAggregation.ts:26`). So loading archived projects into the shared store will not regress global selectors or aggregations — they all explicitly opt out of archived already.

---

## Scope

### In scope

- `src/api/projects.ts`: rename `ProjectFilters.archived` → `ProjectFilters.include_archived`. Matches backend query-param name and the existing `ProjectStatsBulkParams.include_archived` convention. Update the JSDoc / type if any.
- `src/views/projects/ProjectListView.vue`:
  - Replace the one-shot `onMounted(() => projectsStore.fetchProjects())` with an initial fetch that passes the current toggle: `projectsStore.fetchProjects({ include_archived: showArchived.value })`.
  - Add a `watch(showArchived, ...)` that re-calls `projectsStore.fetchProjects({ include_archived: showArchived.value })` on toggle.
  - Drop the client-side `if (!showArchived.value) projects = projects.filter((p) => !p.is_archived)` block in `filteredProjects`. The backend is the single source of truth for archived filtering. Keep the search filter intact.
  - Add `data-testid="show-archived-checkbox"` on the Checkbox (currently only has `inputId="showArchived"` — testid makes Playwright reliable).
- Unit test for the fix: `tests/unit/stores/projects.spec.ts` (new or augment) — assert `fetchProjects({ include_archived: true })` calls the API with `params.include_archived === true`. If a `ProjectListView` unit test exists, augment it; otherwise the store-level test is sufficient.
- Playwright e2e: `tests/e2e/projects.spec.ts` (new) — log in as admin, archive a project via the edit modal, navigate to `/projects`, assert the archived project is hidden, click the checkbox, assert it appears.

### Out of scope

- Pagination of archived projects (today's `page_size` default is 20; users with more than 20 archived projects will need to page through results — separate concern, not regressed by this plan).
- Restoring an archived project from a dedicated UI affordance. Today restoration is "uncheck the archive box in the edit modal and save"; that flow keeps working.
- Soft-delete / hard-delete (`deleted_at`) — covered by [TES-71](https://linear.app/testoria/issue/) follow-up, not this plan.
- Persisting the `showArchived` toggle across sessions (e.g., URL query param or localStorage). Worth doing if QA asks; not the bug we're fixing.
- Backend changes — endpoint already supports `?include_archived=true`.
- Renaming `is_archived` everywhere to a more descriptive name (e.g., `archived_at` timestamp). Schema-level change, not for a bug fix.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| api | `src/api/projects.ts` | `ProjectFilters.archived?` → `ProjectFilters.include_archived?` |
| view | `src/views/projects/ProjectListView.vue` | Pass `include_archived: showArchived.value` to the initial fetch; add a `watch(showArchived, ...)` re-fetch; drop the client-side `is_archived` filter in `filteredProjects`; add `data-testid="show-archived-checkbox"` |
| tests | `tests/unit/stores/projects.spec.ts` | Assert `fetchProjects({ include_archived: true })` forwards the param to the API |
| tests | `tests/e2e/projects.spec.ts` (new) | Archive a project, toggle the checkbox, assert visibility flips |
| docs | `docs/01-product/features/001-project-management.md` | Note that the Show archived toggle is backed by `?include_archived=true` against `GET /projects`; archived projects load on toggle, not at mount |
| docs | `docs/06-generated/api-schema.md` | Update the `getProjects` filter signature row to reflect the renamed `include_archived` param |

### Key decisions

- **Rename `archived` → `include_archived` rather than remap inside `getProjects`.** A field rename matches the backend contract verbatim, eliminates the "two names for the same thing" trap, and aligns with `ProjectStatsBulkParams.include_archived` already in the same `types/project.ts`. The only consumer of `ProjectFilters.archived` today is the (broken) call site we're fixing, so the rename is safe and audited by TypeScript.
- **Server-side filtering only; remove the redundant client-side filter.** The backend is the source of truth for what the user is allowed to see, and the API is paginated — a client-side post-filter on a paginated server response can produce a "page" with fewer rows than `page_size` claims, which is misleading. Dropping the local filter also matches how the stats / suites / runs lists work.
- **Watch, don't add an `@change` handler.** A `watch(showArchived, ...)` triggers regardless of how the ref changes (programmatic reset, future URL-driven restore, etc.) and keeps the template free of imperative handlers. Same pattern used elsewhere in the codebase for filter-driven refetch.
- **Don't reset pagination on toggle.** The store's `fetchProjects` defaults `page` to `pagination.value.page`. Toggling between archived and non-archived keeps the user on the same page number; if they were on page 3 of non-archived results, they stay on page 3 of "all" results. Acceptable for a list this short; revisit if pagination becomes prominent.
- **Add a `data-testid` on the checkbox, not just an `inputId`.** PrimeVue Checkbox renders a wrapper around the native input; a `data-testid` on the component element is the stable target for both unit and e2e tests, regardless of internal markup changes in PrimeVue versions.
- **Don't persist the toggle (yet).** Persisting `showArchived` to localStorage / URL would be a UX improvement but unrelated to the bug. Out of scope.

---

## Tasks

### Implementation
- [x] In `src/api/projects.ts`: rename `archived?: boolean` → `include_archived?: boolean` in `ProjectFilters`
- [x] In `src/views/projects/ProjectListView.vue`:
  - [x] Import `watch` from `vue` (alongside `ref`, `computed`)
  - [x] Initial fetch: `projectsStore.fetchProjects({ include_archived: showArchived.value })`
  - [x] `watch(showArchived, (v) => projectsStore.fetchProjects({ include_archived: v }))`
  - [x] Remove the `if (!showArchived.value) projects = projects.filter((p) => !p.is_archived)` block
  - [x] Add `data-testid="show-archived-checkbox"` on the Checkbox
- [x] Unit test in `tests/unit/stores/projects.spec.ts` (or augment if exists) — `fetchProjects({ include_archived: true })` calls the API with `params.include_archived === true`
- [x] Playwright e2e in `tests/e2e/projects.spec.ts`:
  - [x] Archive a project via edit modal (or via existing seed data containing an archived project)
  - [x] Visit `/projects`, assert archived project is not in the table
  - [x] Click `[data-testid="show-archived-checkbox"]`, assert archived project appears

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict — will catch any other consumer of `ProjectFilters.archived`, of which there are none today)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/001-project-management.md` — note that `Show archived` is server-driven via `?include_archived=true`
- [x] `docs/06-generated/api-schema.md` — update `getProjects` filter signature
- [x] `docs/08-decisions/changelog.md` — plan-085 entry: server-driven archived filter; rename `archived` → `include_archived` to match backend
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Another caller of `fetchProjects({ archived: ... })` breaks at the rename | Very low | Repo-wide grep confirmed `ProjectFilters.archived` has no other consumers. `vue-tsc` strict will catch any I missed |
| Loading archived projects into `projectsStore.projects` regresses other consumers (header selector, run-create dropdown, dashboard aggregation) | Low | All three consumers (`AppHeader.vue:23`, `TestRunCreateView.vue:60`, `usePassRateAggregation.ts:26`) already filter `!p.is_archived` locally — verified by grep. Loading archived into the shared list is a no-op for them |
| Toggling triggers a network round-trip every time, perceived as slow | Low | Endpoint is paginated and small; same cost as initial mount. If a user spams the toggle, axios will queue the requests — acceptable for now. Debounce only if QA reports it |
| Pagination state confuses the user (archived list shorter than non-archived list, page 3 becomes empty) | Low–Medium | Acceptable for current row counts. If it turns out to be visible, queue a follow-up to reset `page` to 1 on toggle |
| Backend returns archived alongside non-archived but client UI doesn't distinguish them visually | Already handled | Existing `Tag` chip in the table shows "Archived" for archived rows (line 247 of ProjectListView.vue). No additional styling needed |
| Playwright archive/restore via the edit modal is brittle | Medium | Test could rely on a seeded archived project instead of mutating one. Decide during test authoring; either approach is acceptable |

---

## Definition of done

- [x] On `/projects`, with at least one archived project in the database, toggling **Show archived** off → archived rows disappear; on → archived rows appear, and the table row count visibly changes
- [x] `getProjects({ include_archived: true })` results in a request with query param `include_archived=true` (verified by unit test)
- [x] No `ProjectFilters.archived` references remain in `src/`
- [x] `ProjectListView.vue` no longer client-side filters `is_archived`
- [x] Other consumers of `projectsStore.projects` (header, run-create) continue to hide archived projects
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Unit test asserts the API param is forwarded
- [x] Playwright e2e covers the toggle visibility flip
- [x] Feature doc updated; api-schema row updated; changelog entry added
- [x] TES-82 marked Done in Linear with the merge commit linked
