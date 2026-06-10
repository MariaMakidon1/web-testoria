# Execution Plan: Test Cases Page — Suite Selection Includes Parent Level

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On `/projects/:projectId/test-cases`, when a user selects a suite in the left tree, display the **parent suite plus all of the parent's descendants** (including the selected suite, its siblings, and their subtrees) — instead of only the selected suite's own subtree. Top-level suite selection behaves as today.

---

## Context

The test-cases page has a left-hand suite tree and a right-hand "cases by suite" panel. Today (`src/components/test-cases/TestCaseTreeView.vue:128-138`):

```ts
const filteredTestCases = computed(() => {
  let cases = [...props.testCases];
  if (selectedSuiteId.value !== null) {
    const suiteIds = getSuiteAndChildIds(selectedSuiteId.value);
    cases = cases.filter((tc) => suiteIds.has(tc.suite_id));
  }
  // ...
});
```

`getSuiteAndChildIds(id)` collects the selected suite plus all descendants. The right-hand panel then renders a section per suite in `flattenedSuites` that has cases after the filter.

Effect reported by the user: selecting a **child** suite hides any cases/suites at the parent level — the user loses context and sees only the deepest slice. The "All test cases" view (no selection) works correctly because it shows the whole tree.

Desired: selecting a suite promotes the scope to the **parent level**, so the user sees the parent suite, the selected suite, the selected suite's siblings, and all their descendants. If the selected suite has no parent (it is top-level), fall back to current behaviour (show itself + descendants).

This is a pure UI-filter change. No backend or data-model changes.

Related:
- plan-068 (in flight) — unifies run detail/execution view via grouped endpoint; different file, unrelated code path
- `TestCaseTreeView.vue` ownership is shared with the test-cases page only; no other caller

---

## Scope

### In scope
- Rework `filteredTestCases` in `TestCaseTreeView.vue` so the displayed scope is "parent of selected + all descendants of parent", with "parent" resolved from the `suiteTree` prop
- Adjust `testCasesBySuite` / `visibleSuites` only if needed to render parent-level cases as their own section
- Preserve current behaviour when no suite is selected (All test cases)
- Preserve current behaviour when a top-level suite is selected (no parent → show itself + descendants)
- Preserve search-query filter composition: search still scopes within the expanded (parent-level) set
- Unit test: child selection includes parent + siblings; root selection is unchanged; no-selection is unchanged
- Visual: the left-tree "selected" highlight stays on the user-clicked suite; the right-panel scope expands

### Out of scope
- Changes to the left-tree rendering or selection UI
- Multi-select (selecting multiple suites simultaneously)
- Backend / store changes
- Any change to the "All test cases" behaviour
- Other views that use suite trees (test-run create, test-run detail, test-run execute) — those have their own selection semantics

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/test-cases/TestCaseTreeView.vue` | (1) Add a helper `getParentSuiteId(suiteId, tree)` that walks `suiteTree` and returns the parent id (or `null` if top-level). (2) Introduce a computed `effectiveScopeSuiteId = parent(selectedSuiteId) ?? selectedSuiteId`. (3) Use `effectiveScopeSuiteId` instead of `selectedSuiteId` in `filteredTestCases` when building the id set via `getSuiteAndChildIds`. (4) Confirm `visibleSuites` still renders sections for the expanded scope (it already walks `flattenedSuites`, so the sections appear naturally once their cases are in scope). |
| tests | `src/components/test-cases/__tests__/TestCaseTreeView.spec.ts` | Test cases: (a) no selection → all cases shown; (b) top-level suite selected → own subtree only (unchanged); (c) child suite selected → parent + all descendants of parent; (d) deeply-nested suite selected → nearest ancestor's subtree; (e) search query on top of a child selection → narrows within parent scope |

### Key decisions

- **Promote one level up, not the full ancestor chain.** The user's wording — "related to parent lvl including parent" — is singular: one parent level. Showing the full ancestor chain (all the way to root) would usually be equivalent to "All test cases" for deeply-nested suites and would dilute the selection. If the user intended the ancestor chain, this is an easy tweak (replace `getParentSuiteId` with a root-walking helper).
- **Top-level suites keep current behaviour.** No parent exists, so "promote" is a no-op. This keeps power users who intentionally pick a top-level suite unaffected.
- **Selected suite in the tree stays the user-clicked one.** Only the right-panel scope expands. Re-anchoring the tree highlight to the parent would be surprising and lose the user's navigation intent.
- **Derive `effectiveScopeSuiteId` from `selectedSuiteId` via a computed.** Keeps the source-of-truth (what the user clicked) separate from the derived view scope. No mutation of `selectedSuiteId` on click.
- **Parent lookup via `suiteTree` (already a prop).** `flattenedSuites` is an array without parent pointers; the tree is the natural structure. Walk once per selection change — cheap and readable.
- **No URL/query-param persistence change.** Selection is in-component state today; leave it that way.

### Open interpretation (flag to user)

- User said: "all related suites and test cases related to parent lvl including parent". Two readings:
  - **One level up (chosen):** select suite S → show `parent(S)` + descendants of `parent(S)`. Clean, bounded scope.
  - **Full ancestor chain:** select suite S → show every ancestor of S (root → S's parent) + S + descendants of S. Broader; at deep levels, approximates "All test cases".
- If the user wants the chain interpretation, replace `getParentSuiteId` with an `ancestorChainIds` helper and merge with `getSuiteAndChildIds(selectedSuiteId)`.

---

## Tasks

### Implementation
- [ ] Add `getParentSuiteId(suiteId, tree)` helper in `TestCaseTreeView.vue` (walk `TestSuiteTree[]`, return parent id or null)
- [ ] Add `effectiveScopeSuiteId` computed
- [ ] Update `filteredTestCases` to use `getSuiteAndChildIds(effectiveScopeSuiteId)` when a suite is selected
- [ ] Verify `visibleSuites` naturally surfaces parent + siblings (no change expected; spot-check)
- [ ] Update/add unit tests per the cases in the Changes table
- [ ] Manual smoke on dev server:
  - [ ] No selection → all suites and cases visible
  - [ ] Top-level suite selected → same as before (own subtree only)
  - [ ] Child suite selected → parent and siblings visible in the cases panel; left-tree highlight stays on the child
  - [ ] Deeply nested selection → nearest parent's subtree
  - [ ] Selection + search → search narrows within the expanded scope

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/` — update the test-case-management feature doc (if it describes suite filtering) to note the "parent-level scope" behaviour
- [ ] `docs/08-decisions/changelog.md` — one-line entry: suite selection on test-cases page now scopes to parent level + descendants
- [ ] `docs/04-execution/tech-debt.md` — no debt expected; add a line only if the ancestor-chain alternative remains an open product question
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| User meant "full ancestor chain" rather than "one level up" | Medium | Flagged in Key decisions; switch is a one-function swap |
| Users relied on the old narrow-scope behaviour (e.g. to isolate a deep leaf) | Low | The tree is still visible; power users can still identify the leaf. Add a follow-up toggle only if feedback asks for it. |
| `suiteTree` is empty or not yet loaded when `effectiveScopeSuiteId` is computed | Low | Fall back to `selectedSuiteId` when parent lookup returns null for any reason (already the top-level fallback); never throw |
| Deeply-nested suites (>3 levels) cause a confusing "parent of parent" expectation | Low | Only the immediate parent is promoted; deeper users can click up the tree. Document the behaviour in the feature doc. |
| Left-tree expanded/collapsed state feels inconsistent when the right panel shows a broader scope | Low | Tree expand/collapse is already per-suite via `uiStore.toggleSuiteExpand`; no changes needed, but spot-check during smoke |

---

## Definition of done

- [ ] Selecting a child suite on `/projects/:projectId/test-cases` shows the parent suite's cases section plus all sibling subtrees in the right panel
- [ ] Selecting a top-level suite behaves as before (own subtree only)
- [ ] No selection behaves as before (all test cases)
- [ ] Search query composes correctly with the new scope
- [ ] Left-tree selection highlight stays on the user-clicked suite
- [ ] Unit tests cover no-selection, top-level, child, deeply-nested, and search-composition cases
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
