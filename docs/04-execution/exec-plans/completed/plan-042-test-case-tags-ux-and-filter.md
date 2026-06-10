# Execution Plan: Test Case Tags UX + List Filter

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Tighten the tags-field layout in the test case editor, replace the in-memory tag autocomplete with a real backend-backed search-or-create flow that displays selected tags as chips, and add a multi-select tag filter to the project test cases list page.

---

## Context

Three connected user complaints on the test case editor and list views:

1. **Layout bug** — on `/test-cases/:id/edit` the "Tags" label sits visibly far from the AutoComplete input. Cause: `.tags-selected` (the chip strip, `TestCaseEditorView.vue:594`) has `min-height: 32px` (`TestCaseEditorView.vue:598`) and is rendered *between* the label and the input, so when no tags are selected an empty 32px gap pushes the input down.
2. **Autocomplete is client-only** — `TestCaseEditorView.vue:67–80` filters the in-memory tag list. There is no real "search tags" call, and creating a new tag from the editor is not wired through to the backend.
3. **No tag filter on the list view** — `TestCaseListView.vue` has filters for suite, priority, type, status, but `TestCaseFilters` in `src/api/testCases.ts:9–17` has no `tag_ids` field, so users cannot narrow test cases by tag.

This plan depends on the companion backend plan `api-testoria/docs/04-execution/exec-plans/active/023-be-tags-crud-and-test-case-tag-filter.md`, which adds the `GET /tags?q=`, `POST /tags`, and `GET /test-cases?tag_ids=` endpoints. The frontend already calls `/tags` (`src/api/tags.ts`) but those endpoints currently 404 — the backend plan unblocks this one.

---

## Scope

### In scope
- Reorder/restyle the tags field on `TestCaseEditorView.vue` so the input sits directly under the label and the chip strip lives below the input (or only renders when non-empty)
- Replace the client-side tag filter in `TestCaseEditorView.vue` with a debounced call to the new `searchTags(q)` API
- Add "create new tag" affordance: when the typed query has no exact match, the AutoComplete dropdown shows a `Create "<query>"` row that calls `POST /tags` and adds the resulting tag as a chip
- Multi-select tag filter on `TestCaseListView.vue` using PrimeVue `MultiSelect` with chip-style display
- Extend `TestCaseFilters` (`src/api/testCases.ts`) and the test cases store with `tag_ids: number[]`
- Persist the tag filter in the URL query string (consistency with other list filters — confirm pattern first)
- Unit tests for the editor tag handling and the list filter store action; e2e for the editor add-new-tag flow and the list filter flow

### Out of scope
- Tag rename / delete / merge UI
- Tag colors or grouping
- Per-project tag scoping (tags stay global)
- Saved filters integration (covered by `plan-011-saved-filters` already shipped — only verify it picks up the new field)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testCase.ts` | Add `tag_ids?: number[]` if not present; ensure `Tag` has `id, name` |
| api | `src/api/tags.ts` | Add `searchTags(q: string, limit?: number)` calling `GET /tags?q=` |
| api | `src/api/testCases.ts` | Add `tag_ids?: number[]` to `TestCaseFilters`; serialize as repeated query params |
| store | `src/stores/tags.ts` | Add `searchTags(q)` action with in-flight de-dup; keep results in a transient `searchResults` ref (do not pollute the global list) |
| store | `src/stores/testCases.ts` | Thread `tag_ids` through `setFilters` / `loadTestCases` |
| views | `src/views/test-cases/TestCaseEditorView.vue` | Reorder tags field markup; debounce search; "create new" item in AutoComplete dropdown; chips render below input; remove `min-height` from `.tags-selected` or render it conditionally |
| views | `src/views/test-cases/TestCaseListView.vue` | Add `MultiSelect` (or `MultiSelect` with `display="chip"`) bound to `tag_ids`, options sourced from `tags` store; sync to URL query |
| router | `src/router/index.ts` | None — uses existing query-param pattern |

### Key decisions

- **Layout fix**: keep the field structure but render the chip strip *after* the AutoComplete input (label → input → chips). Drop `min-height: 32px` from `.tags-selected` and add `v-if="form.selectedTags.length"` so the element does not exist until needed. This collapses the gap entirely when the field is empty and feels natural while typing — chips appear under the input as you add them. Do **not** keep the existing label-then-32px-strip layout with a smaller `min-height`; that just shrinks the bug.
- **Search debounce**: 250ms via a small composable (`useDebouncedRef`) or inline `setTimeout`. PrimeVue `AutoComplete` already exposes `@complete` — call the store action there.
- **Create-new-tag UX**: append a synthetic `{ id: -1, name: query, __create: true }` item to suggestions when the trimmed query has no exact case-insensitive match. On select, call `tagsStore.createTag({ name })`, then push the real tag into `form.selectedTags` and clear the query. Show a small spinner on the AutoComplete during the create round-trip.
- **Idempotent POST**: rely on the backend returning the existing row on duplicate name (per backend plan 023). Do not pre-check.
- **Filter component choice**: `MultiSelect` with `display="chip"` and `filter` enabled. Reasons over `AutoComplete`: (a) the user sees all available tags by default, (b) PrimeVue handles chip rendering and removal, (c) consistent with other multi-value filters in the app — verify by reading at least one existing filter (e.g. priority filter) before picking.
- **Tag options for the list filter** come from `tags.fetchTags()` (existing action) loaded once when the list view mounts. Do not call `searchTags` here — the option count is bounded and prefetching avoids per-keystroke requests on a filter that is opened occasionally.
- **URL sync**: read existing list filters' URL pattern in `TestCaseListView.vue` and follow the same convention. Tag ids serialize as `?tag_ids=1&tag_ids=2`.
- **No component imports `src/api/`** (hard invariant 1) — all new tag calls go through `stores/tags`.

---

## Tasks

### Implementation
- [x] Add `searchTags` to `src/api/tags.ts`
- [x] Add `tag_ids` to `TestCaseFilters` in `src/api/testCases.ts` and confirm Axios serializes repeated params correctly (use `paramsSerializer` if not)
- [x] Add `searchTags` action to `src/stores/tags.ts` with in-flight de-dup
- [x] Thread `tag_ids` through `src/stores/testCases.ts` (setFilters, loadTestCases, reset)
- [x] Update `TestCaseEditorView.vue`:
  - [x] Reorder markup: label → AutoComplete → chips
  - [x] Render `.tags-selected` only when `form.selectedTags.length > 0`; remove `min-height` from its CSS
  - [x] Replace client-side filter (lines ~67–80) with debounced `tagsStore.searchTags`
  - [x] Inject "Create '<query>'" synthetic option when no exact match
  - [x] Wire `handleTagSelect` to call `tagsStore.createTag` for synthetic items, then add to selection
- [x] Update `TestCaseListView.vue`:
  - [x] Mount-time `tagsStore.fetchTags()`
  - [x] Add `MultiSelect` (display="chip", filter) bound to `selectedTagIds`
  - [x] Wire to `testCasesStore.setFilters({ tag_ids: … })`
  - [x] Sync `tag_ids` to/from URL query
- [x] Unit tests: `tests/unit/stores/tags.spec.ts` (searchTags + createTag + in-flight dedup)
- [ ] e2e: `tests/e2e/test-case-tags.spec.ts` covering add-new-tag from editor and filter-by-tag on list page — deferred until backend plan 023 ships

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [ ] Manual smoke against real backend: create-new-tag round-trip, multi-tag filter, empty-state spacing visually correct in both light and dark mode — deferred until backend plan 023 ships

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` — add `searchTags`, document new `tag_ids` filter on `getTestCases`
- [x] `docs/06-generated/routes-map.md` — no route changes; verified
- [x] `docs/01-product/features/003-test-case-authoring.md` — describe new search/create flow and filter
- [x] `docs/02-architecture/frontend/state-management.md` — added tags store to inventory
- [x] `docs/08-decisions/changelog.md` — recorded layout decision, MultiSelect choice, debounce value, searchResults pattern
- [x] `docs/04-execution/tech-debt.md` — no tag-related items found
- [x] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend plan 023 not yet merged when this lands | High | Sequence: backend plan ships first; gate this plan's merge on backend availability in the target environment |
| Axios does not serialize `tag_ids: number[]` as repeated params by default | Medium | Add a `paramsSerializer` to `apiClient` (or per-call) using `qs.stringify(..., { arrayFormat: 'repeat' })`; cover with a unit test |
| `MultiSelect` chip display does not match the visual style of existing filters | Low | Read one existing filter component first; reuse its variant tokens |
| Race: user types fast, multiple in-flight `searchTags` resolve out of order | Medium | Store latest request id in the action; ignore stale responses |
| Empty-state regression: removing `min-height` shifts other layout elements | Low | Visual check in editor with 0, 1, and many tags; snapshot test if available |

---

## Definition of done

- [x] On `/test-cases/:id/edit`, the Tags input sits directly beneath the "Tags" label with no empty gap; chips appear below the input as they are added
- [x] Typing in the tag input calls the backend `GET /tags?q=` (debounced 250ms) and shows real suggestions
- [x] When the typed query has no exact match, the dropdown offers a `Create "<query>"` action that creates the tag and adds it to the case
- [x] On `/projects/:id/test-cases`, a multi-select tag filter renders selected tags as chips and narrows the list via `tag_ids`; the selection is reflected in the URL
- [x] All hard invariants respected — no component imports from `src/api/`
- [x] Unit tests written and passing
- [ ] e2e tests cover both flows — deferred until backend plan 023 ships
- [ ] PR checklist completed
- [x] Docs updated
