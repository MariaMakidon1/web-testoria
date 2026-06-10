# Execution Plan: Cases panel on `/projects/:id/test-cases` shows every suite and matches the aside order

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

On `/projects/:projectId/test-cases`, the main cases-panel must:

1. **Render every suite**, including suites with zero test cases (today they're hidden).
2. **Use the same order as the aside suite-panel** (today the aside follows the backend order, the cases-panel re-sorts alphabetically — so the two disagree).

Both issues live in `TestCaseTreeView.vue`; the aside panel and the main panel already read from the same `suiteTree` prop. The cases-panel just derives and re-sorts its own list and diverges.

---

## Context

Both panels share this component (`src/components/test-cases/TestCaseTreeView.vue`):

- **Aside** (`<aside class="suite-panel">`, lines 290–334) passes `props.suiteTree` straight into `<TestSuiteTree :suites="suiteTree">`. That child renders `v-for="suite in suites"` with no re-sort (`TestSuiteTree.vue:103`). Order is whatever the backend returns — today `created_at ASC` (`api-testoria: app/services/test_suite_service.py:42`), tightened by api plan 037 to `(display_order NULLS LAST, created_at ASC, id ASC)`.
- **Cases-panel** (`<main class="cases-panel">`, lines 337+) drives its sections off `visibleSuites`:

```ts
// TestCaseTreeView.vue:163-170
const visibleSuites = computed(() => {
  const suiteIds = new Set(testCasesBySuite.value.keys());         // ← suites WITH cases only
  return Array.from(suiteIds)
    .map((id) => suiteMap.value.get(id))
    .filter((s): s is TestSuite => s !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name));                 // ← alphabetic, diverges from aside
});
```

Two bugs, both here:

1. `testCasesBySuite` is built from `filteredTestCases` (only the cases that pass the filter), so any suite with zero matching cases is dropped from the list entirely.
2. Once the IDs are collected, they're re-sorted by `name.localeCompare`, ignoring the backend-provided order that the aside honours.

### Why fixing this with the existing data works

The `suiteTree` prop is already the same tree both panels see. Traversing it top-down — instead of deriving an ad-hoc list from `testCasesBySuite.keys()` — gives:

- **All suites**: every node in the tree becomes a section, even when it has no cases.
- **Consistent order**: traversal order = aside render order, which = backend order.

The empty sections then render their existing "Add Case" / "Add Subsection" affordances; the filtered search (by title or id) simply yields zero matches for empty suites without hiding them.

### Flattened vs nested rendering

The current cases-panel renders a flat list of sections, one per suite that has cases. The tree is deeper than that: child suites can have their own cases. Today, a child suite's cases show up as a separate flat section next to its parent, which is already a bit confusing — this plan preserves that flat layout (one section per suite, flattened in tree order) rather than introducing nested sections. Nested rendering is logged as tech debt.

---

## Scope

### In scope (page `/projects/:projectId/test-cases` only)

- Replace `visibleSuites` derivation so every suite in `props.suiteTree` (and its descendants) becomes a section, in tree traversal order (depth-first)
- Remove the alphabetic `name.localeCompare` sort — order now follows the tree, which follows the backend
- For the search filter: if a search query is active, only suites that have at least one matching case appear — searching an empty world is allowed to collapse; searching an empty suite produces an empty section inside the hit list only if the user's search also matches the suite's name (stretch — documented below)
- Re-wire `testCasesBySuite` to key on the suite id as today; sections with no cases render an "empty suite" CTA row ("No test cases yet. Add one." + "Add Case" / "Add Subsection" buttons) rather than being hidden
- Confirm the existing per-section expand/collapse state (`sectionExpandedStates`) correctly handles the new empty sections (they should default collapsed, since there's nothing inside — reduces visual noise)
- No change to the aside suite-panel
- Unit tests covering: no cases project → every suite rendered as empty; mixed → order matches aside; search with no match → sections empty but present (when not in search mode)
- E2E: seed a project with (a) populated suites, (b) empty suites interleaved; assert the cases-panel lists all of them in aside order; confirm search hides non-matching sections

### Out of scope

- Nested section rendering (child suites nested inside parent sections) — logged as follow-up
- Drag-and-drop reorder — separate plan, depends on api plan 037's `display_order` surfaced through a PATCH endpoint
- Alphabetic sort mode — api plan 037 explicitly punts this to a `?sort=` param plan
- Changes to the aside panel
- Changes to the test-cases index page (`/test-cases`)
- Performance optimisation for projects with hundreds of suites — logged as tech debt if it bites

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-cases/TestCaseTreeView.vue` | Rewrite `visibleSuites`: DFS traverse `props.suiteTree`, flatten to an ordered list of every suite; **remove** the alphabetic sort |
| components | `src/components/test-cases/TestCaseTreeView.vue` | Update `testCasesBySuite` to keep the empty-default shape (`Map` seeded with every visible suite id → `[]`) so sections render with an empty array instead of being skipped |
| components | `src/components/test-cases/TestCaseTreeView.vue` | Template: empty-section CTA block (uses existing `handleAddCase` / `handleAddSubsection` emits); default to collapsed for empty sections |
| components (no change) | `src/components/test-cases/TestSuiteTree.vue` | Already renders in `props.suiteTree` order — no change |
| types | none new | Uses existing `TestSuiteTree`, `TestCase`, `TestSuite` |
| tests | `tests/unit/components/TestCaseTreeView.spec.ts` | Order / empty / search scenarios |
| e2e | `tests/e2e/test-cases-panel.spec.ts` | Visual + interaction |

### Key decisions

- **DFS traversal is the single source of order.** Both panels read `props.suiteTree`; as long as the cases-panel traverses in DFS order, it matches what the aside renders. No client-side sort. API plan 037 guarantees the backend returns a stable order; the web stops imposing its own.
- **Empty suites render as sections with a CTA.** Hiding them was a silent UX failure — a user creating a suite ahead of cases couldn't see it in the main area and had to rely on the aside. Showing them surfaces the "Add Case" affordance where the user already looks.
- **Empty sections default to collapsed.** A screen full of expanded empty sections is noise; collapsed shows "Smoke (0 cases)" and lets the user expand / add. Existing `sectionExpandedStates` persists user choices; only the default for new empties changes.
- **Search filter behaviour: an empty suite stays hidden during an active search.** Otherwise a user searching "login" would see every empty suite and struggle to parse the result list. An empty suite is visible only when the search is cleared.
- **Flat layout preserved.** Rendering child suites nested inside parent sections is a bigger UX change (visual hierarchy, expand-all semantics, etc.). Out of scope; logged. The flat section list in tree-traversal order keeps parent / child adjacency readable.
- **No sort-param UI.** Ordering stays "whatever the backend says". If product wants alphabetic later, api plan 037's follow-up adds a `?sort=` param and a dropdown here.

---

## Tasks

### Implementation
- [ ] Confirm api plan 037 is merged or scheduled — the stable `(display_order, created_at, id)` order makes this plan's "match aside" guarantee meaningful; without it, both panels still agree but on a less stable order
- [ ] Rewrite `visibleSuites` in `TestCaseTreeView.vue`:
  - [ ] DFS traversal helper walking `props.suiteTree` → `TestSuite[]`
  - [ ] Remove `sort((a, b) => a.name.localeCompare(b.name))`
  - [ ] Do **not** filter by `testCasesBySuite.keys()` — include every node
- [ ] Update `testCasesBySuite` construction:
  - [ ] Initialise the map with every visible suite id → empty array
  - [ ] Populate from `filteredTestCases` as today
- [ ] Template: detect empty-case sections and render a slim empty-state row with existing Add-Case / Add-Subsection buttons
- [ ] Default expand state: for brand-new visible-but-empty sections, set collapsed unless the user has already toggled them; preserve existing user-set states via `sectionExpandedStates`
- [ ] When `searchQuery` is non-empty:
  - [ ] Keep the current behaviour of showing only suites whose cases matched
  - [ ] Exception: none — empty suites stay hidden during search
- [ ] Unit tests:
  - [ ] Project with 3 suites in backend order A, B, C; cases only in B → sections appear in order A, B, C (A and C empty)
  - [ ] Backend order ≠ alphabetic → cases-panel order matches backend (not alphabetic)
  - [ ] Child suite with no direct cases → appears as its own empty section in DFS order
  - [ ] Search active → only matching suites, empty suites hidden
  - [ ] `sectionExpandedStates` for an existing suite that becomes empty is preserved; newly-visible empties default collapsed
- [ ] E2E:
  - [ ] Seed a project with suites in backend order `[Regression, Smoke, Auth]`, with cases only in `Smoke`; open `/projects/:id/test-cases`; assert three sections in the order Regression (empty, collapsed), Smoke (expanded with cases), Auth (empty, collapsed)
  - [ ] Click "Add Case" inside an empty section → dialog pre-selects that suite
  - [ ] Search "login" with no matches in empty suites → empty suites disappear during search; clear search → they return
- [ ] Manual: dark-mode rendering of the empty-section row; responsive / mobile layout unchanged
- [ ] Manual: large project (50+ suites) still performs (DFS traversal is O(n))

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build` (vue-tsc)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — update the test-cases feature file (if present) to describe empty-suite visibility
- [ ] `docs/02-architecture/frontend/components.md` — note that `TestCaseTreeView` traverses the shared `suiteTree` prop and does not impose its own sort
- [ ] `docs/08-decisions/changelog.md` — record: cases-panel now shows empty suites; sort follows the backend-provided tree order; alphabetic sort intentionally dropped
- [ ] `docs/04-execution/tech-debt.md` — log follow-ups: (a) nested section rendering for child suites, (b) alphabetic sort as a user-facing toggle once api plan 037's `?sort=` follow-up lands, (c) virtualised section list for very large projects
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Existing users relied on the alphabetic sort | Medium | Changelog entry; the aside already uses backend order, so the page as a whole becomes more consistent — not less |
| Projects with many empty suites produce a cluttered panel | Medium | Empty sections default to collapsed; only the header row + count is visible; a future "hide empty" toggle can be added if feedback warrants |
| `sectionExpandedStates` state drifts (persists stale keys for deleted suites) | Low | Existing watcher (`visibleSuites` → cleanup) already handles this; verify it still runs after the rewrite |
| Search UX regresses because empty suites suddenly appear / disappear | Low | Documented: empty suites hidden during search; tests cover the toggle |
| DFS traversal order differs from the aside's render order for deeply nested trees | Low | Both read the same `suiteTree`; the aside's `<TestSuiteTree>` also renders DFS (v-for of children recursively); verified by a side-by-side test |
| Flat DFS places a deeply nested grandchild visually adjacent to an unrelated suite | Low | Preserves current flat layout; nested rendering tracked as follow-up |
| Performance regresses with hundreds of empty suites | Low | DFS and per-section rendering are O(n); virtualisation logged as tech debt if ever needed |

---

## Definition of done

- [ ] Every suite in `props.suiteTree` appears as a section in the cases-panel (empty suites included)
- [ ] Sections appear in the same DFS order as the aside suite-panel
- [ ] No client-side `name` sort in `TestCaseTreeView`
- [ ] Empty sections render a compact "No test cases yet. Add one." row with working Add-Case / Add-Subsection affordances
- [ ] Empty sections default to collapsed; previously-expanded user choices persist
- [ ] Search hides non-matching suites (including empties); clearing search restores them
- [ ] Unit + e2e tests cover the scenarios above
- [ ] Dark-mode and responsive layout verified
- [ ] Docs updated; follow-ups logged
- [ ] PR checklist completed
