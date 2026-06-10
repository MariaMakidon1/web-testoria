# Execution Plan: Edit Run Cases Dialog — Always Refetch Suites and Cases on Open

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Whenever the Edit Cases dialog opens — from either the test-runs list (row action) or the run detail page (header button) — always refetch the project's suite tree and the test cases under each suite, so the user picks from the current source-of-truth rather than a stale cache.

---

## Context

`EditRunCasesDialog.vue` is the shared component mounted by:
- `src/views/test-runs/TestRunListView.vue:325-330` — opened from the row "Edit cases" action
- `src/views/test-runs/TestRunDetailView.vue:332+` — opened from the header "Edit Cases" button

The dialog's open logic (`EditRunCasesDialog.vue:45-83`):
```ts
async function loadAllSuiteCases() {
  loadingTree.value = true;
  try {
    if (testSuitesStore.testSuites.length === 0) {            // ← only on empty cache
      await testSuitesStore.fetchTestSuites(props.projectId);
    }
    const suites = testSuitesStore.testSuites;
    await Promise.all(
      suites.map((s) =>
        testCasesStore.fetchTestCasesBySuite(props.projectId, s.id),   // ← store caches per suite
      ),
    );
  } finally { ... }
}

watch(() => props.visible, async (isVisible) => {
  if (!isVisible) return;
  // ...
  await loadAllSuiteCases();
}, { immediate: true });
```

Two cache paths each block the refresh:
1. **Suite tree**: `fetchTestSuites` is only called when `testSuites.length === 0`. Once the store has suites from any earlier session (test-case list page, create dialog, etc.), this conditional is false forever until the store is cleared.
2. **Cases per suite**: `fetchTestCasesBySuite` in `testCases` store caches into `casesBySuite` keyed by suite id and short-circuits on cache hit (visible from the dialog's own `handleExpandSuite` at line 63: `if (testCasesStore.casesBySuite[suiteId]) return;`).

Effect: a user who creates a new test case in another tab, or has cases added by a teammate, opens Edit Cases and doesn't see the new entries until a hard reload. Similarly, suite renames/deletes are invisible.

Related prior work:
- plan-069 — create empty test run + edit cases later (introduced the dialog)
- plan-067 — edit run metadata dialog
- plan-034 (api) — `PUT /test-runs/{id}/cases` with 409 when run is completed

---

## Scope

### In scope
- On dialog open (visibility transition from `false` to `true`), unconditionally refetch:
  - `testSuitesStore.fetchTestSuites(projectId)` — refresh the tree
  - cases per suite — force a refetch, bypassing or invalidating `casesBySuite` cache
- Do the two refetches in parallel where safe (suites first, then fan-out by suite — same structure as today, but without the cache guards)
- Show the existing `loadingTree` spinner during the refetch so the user sees progress
- Preserve selection state correctly: the dialog already seeds `selectedCaseIds` from `props.initialSelectedIds` before the fetch — make sure the post-fetch set union still honours the initial selection even if some previously selected cases no longer exist (silently drop missing ids; toast a soft warning if any are dropped)
- Add a minimal refetch helper on `testCasesStore` (e.g. `refreshCasesBySuite(projectId, suiteId)`) rather than reaching into store internals from the component
- One unit test per entry point: opening from list view triggers both refetches; opening from detail view triggers both refetches; closing and reopening triggers both again

### Out of scope
- Global cache invalidation policy for the test-cases / test-suites stores (a larger architectural call — tracked as tech debt)
- Realtime updates via Centrifugo to keep the dialog in sync while open (future plan; the current fix covers "open → see fresh data")
- Changes to the Edit Cases save flow (`PUT /test-runs/{id}/cases`)
- UI redesign of the dialog

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| store | `src/stores/testCases.ts` | Add `refreshCasesBySuite(projectId, suiteId)` that forces a fetch and overwrites `casesBySuite[suiteId]`, or extend the existing `fetchTestCasesBySuite` with an optional `{ force?: boolean }` param. Prefer the explicit method name for clarity at the call site. |
| store | `src/stores/testSuites.ts` | Verify `fetchTestSuites(projectId)` always refetches when called (should — the fetch itself isn't gated). If not, add a `force` option. |
| component | `src/components/test-runs/EditRunCasesDialog.vue` | (1) In `loadAllSuiteCases`, remove the `if (testSuitesStore.testSuites.length === 0)` guard — always call `fetchTestSuites`. (2) Replace `fetchTestCasesBySuite` calls with `refreshCasesBySuite`. (3) After the fetch, prune `selectedCaseIds` to only ids present in the refreshed cases; toast a soft warning if the pruned set is smaller than `initialSelectedIds`. (4) `handleExpandSuite` (line 62) can keep its cache-short-circuit for on-demand expansion, since opening the dialog has already seeded the cache — document the distinction with a one-line comment only if it's non-obvious. |
| tests | `src/components/test-runs/__tests__/EditRunCasesDialog.spec.ts` | Stub stores; open dialog → assert `fetchTestSuites` and `refreshCasesBySuite` called per suite. Close + reopen → assert called again. Initial selection referencing a now-deleted case → assert pruned + warning toast. |

### Key decisions

- **Explicit `refreshCasesBySuite` over `fetch…({ force: true })`.** A new named method reads clearly at the call site and keeps the default `fetchTestCasesBySuite` semantics intact for other callers that legitimately want cache-backed reads.
- **Keep the `handleExpandSuite` cache short-circuit.** Once the dialog has opened and fanned out the initial fetch, on-demand suite expansion (if the UI supports it) can rely on the just-refreshed cache. Only the open-time fetch needs to be forced.
- **Prune stale selections silently with a soft toast.** If a user had 10 cases selected and one was deleted elsewhere, the dialog should reopen with 9 selected (not 10 including a dead id) and surface a small warning so the user knows. Hard-erroring would be worse UX.
- **No debounce on the fetch.** The dialog only opens via explicit user action; there is no rapid open/close loop to protect against.
- **No pagination change.** Refetching fan-out is unchanged; if a project has many suites, the dialog will fetch them in parallel exactly as today (just without cache hits). A larger "paginate suite tree / lazy-load" work is a separate plan.

---

## Tasks

### Implementation
- [ ] Add `refreshCasesBySuite(projectId, suiteId)` to `src/stores/testCases.ts` (forces network fetch, replaces `casesBySuite[suiteId]`)
- [ ] Confirm `fetchTestSuites` is not gated by a cached-data guard; if it is, add a force path
- [ ] `EditRunCasesDialog.vue`: remove the `testSuites.length === 0` guard in `loadAllSuiteCases`
- [ ] `EditRunCasesDialog.vue`: switch per-suite fetch calls to `refreshCasesBySuite`
- [ ] `EditRunCasesDialog.vue`: after refetch, prune `selectedCaseIds` to the set of valid ids; toast a warning if the pruned count is smaller
- [ ] Spot-check `handleExpandSuite` keeps its cache short-circuit (on-demand expansion)
- [ ] Unit tests:
  - [ ] Open from list view → fetchTestSuites + refreshCasesBySuite called per suite
  - [ ] Open from detail view → same assertions
  - [ ] Close → reopen → fetches fire again
  - [ ] Initial selection with one deleted id → pruned, warning toast
- [ ] Manual smoke on dev server:
  - [ ] In tab A, open Edit Cases; in tab B, add a new test case to the project; close dialog in A, reopen → new case is visible and selectable
  - [ ] In tab B, delete a case currently selected on the run; reopen Edit Cases in A → selection pruned, warning toast
  - [ ] From test-runs list row → Edit Cases opens with current data
  - [ ] From run detail header → Edit Cases opens with current data

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — if the test-run-management feature doc describes cache semantics of Edit Cases, update it
- [ ] `docs/02-architecture/frontend/state-management.md` — add a one-liner on the new `refreshCasesBySuite` helper and when to use it
- [ ] `docs/08-decisions/changelog.md` — short entry: Edit Cases dialog refetches suites + cases on open from any entry point
- [ ] `docs/04-execution/tech-debt.md` — add "global invalidation policy for test-cases / test-suites stores" as new debt (optional follow-up)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Projects with many suites cause a slow dialog open due to serial/parallel fan-out fetches | Medium | Already parallel via `Promise.all`; spinner visible. Log a tech-debt follow-up to lazy-load on expansion if a specific project crosses a usability threshold. |
| Removing the cache guard slows other parts of the app that share the store state | Very low | Only this component calls `refreshCasesBySuite`; existing cache-backed `fetchTestCasesBySuite` callers are unchanged. |
| Pruning stale selections surprises the user who expected the old selection to remain | Low | Warning toast names the deleted count. Save is still gated by user confirmation. |
| Refetch fires during a pending save (user closes and reopens quickly) | Low | Save state is tracked by `saving.value`; open-time refetch runs on the `visible` watch, which only fires on an actual toggle. If races show up, guard with a simple in-flight flag. |
| Backend test-case endpoint lacks a bulk "all cases for project" variant, so N fetches per open is wasteful | Medium | Existing shape; same as pre-fix. Flag as follow-up: consider adding `GET /projects/:id/test-cases?fields=id,suite_id,title` to collapse to one call. |

---

## Definition of done

- [ ] Opening the Edit Cases dialog from `/test-runs` row action issues `fetchTestSuites` + `refreshCasesBySuite` for each suite — verified in the network tab on every open
- [ ] Opening the Edit Cases dialog from `/test-runs/:id` header button issues the same refetches
- [ ] A test case added or removed in another tab/session is reflected in the dialog on the next open without a page reload
- [ ] Previously selected case ids that no longer exist are silently pruned and a warning toast is shown
- [ ] Existing save flow (`PUT /test-runs/{id}/cases`) still works; run progress/cases refresh after save as today
- [ ] Unit tests cover both entry points and the pruning path
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
