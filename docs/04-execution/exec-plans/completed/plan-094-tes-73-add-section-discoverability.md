# Execution Plan: Promote "Add Section" Discoverability (TES-73)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Make "Add Section" obvious from the very first moment a user lands on the test-cases page of an empty project, and make the same affordance equally visible to every user with the `isProjectManager` flag inside any non-empty state. Specifically: surface a labelled **Add Section** primary button in the no-suites empty state (today only "Add Test Case" is shown, which is the wrong CTA — a case needs a suite first), promote the sidebar's tooltip-only `+` icon to a labelled button, and replace the text-link "Add Case" / "Add Subsection" inside `TestCaseSection` with proper PrimeVue Buttons so they read as actions rather than footnotes.

Linear: [TES-73](https://linear.app/testoria/issue/TES-73/add-section-button-hidden-in-empty-test-suite-state-and-poorly) — Bug, Medium. Parent: TES-68. Ref: Alex's POC review 2026-04-28 — BUG-003 + BUG-004 + BUG-006.

---

## Context

In `src/views/test-cases/TestCaseListView.vue` and `src/components/test-cases/TestCaseTreeView.vue`, three discoverability gaps stack up:

1. **No-suites empty state** (`TestCaseTreeView.vue:456-469`): when a project has zero suites, the only call-to-action is `Add Test Case`. The user can't actually create a case without picking a suite first — clicking the button opens the create dialog with no suite to assign. The first thing to surface is **Add Section**.
2. **Sidebar `+` button** (`TestCaseTreeView.vue:360-369`): the only "create a top-level section" affordance outside the empty state is a `text rounded` icon-only Button with a tooltip. On a busy page it reads as decoration. Promote to a labelled secondary button.
3. **Section-actions text links** (`TestCaseSection.vue:222-235`): "Add Case" and "Add Subsection" are rendered as `<a href="#" class="action-link">` with a leading icon. Below the empty-state hint ("No test cases in this section"), they read as fine-print rather than primary actions. Convert to proper `<Button>` components so they match the visual weight of every other create CTA in the app.

None of this needs backend changes — the create flows for both suites and cases already exist (`testSuitesStore.createTestSuite`, `testCasesStore.createTestCase`). The work is purely visual/CTA promotion and an empty-state rewrite.

---

## Scope

### In scope

- **Empty state** in `TestCaseTreeView.vue` (no suites): replace the single `Add Test Case` button with a primary **Add Section** button + a secondary **Add Test Case** button. The page-level copy adapts to whether the project has zero suites, zero cases, or a search returned nothing:
  - Project has zero suites → "No sections yet" + `Add Section` (primary) + `Add Test Case` (secondary, disabled with tooltip if no suites exist).
  - Project has suites but no cases at all → "No test cases yet" + `Add Test Case` (primary) + `Add Section` (secondary).
  - Search returned nothing → "No test cases match your search" (no CTAs — current behaviour).
- **Sidebar header**: promote the icon-only `+` Button to a labelled `Add Section` button with a leading `pi pi-plus` icon. Keep `data-testid` and `aria-label` for existing selectors.
- **Section actions**: in `TestCaseSection.vue`, replace the two `<a class="action-link">` links with PrimeVue `<Button>` components (`text size="small"`, leading icon, labelled). They keep their `isProjectManager` gate, their handlers, and their grouping in the `.section-actions` row.
- Playwright: a single regression case that loads a project with zero suites, asserts the `Add Section` empty-state button is visible, clicks it, and confirms the create-section dialog opens. (The existing test-cases spec already covers the populated path.)

### Out of scope

- A nested "first-run" coachmark / onboarding tour. Out of scope; if onboarding ever ships it should pick this state up automatically.
- Re-skinning the "Add Test Case" CTA — copy and severity stay as-is when it's not the primary slot.
- Adding inline create-from-empty composer (i.e. typing the section name directly in the empty state without opening a dialog). The "Add Section" button continues to route through the existing dialog flow for consistency with every other create surface.
- Touching the mobile breakpoint behaviour — the suite panel is hidden on mobile today, and that stays; the empty-state CTA is visible on mobile because the main content panel is.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/test-cases/TestCaseTreeView.vue` | Empty-state CTA rewrite: primary button picks `add-suite` vs `add-case` based on whether any suites exist; sidebar `+` Button gains a `label="Add Section"`. New computed `hasAnySuites` |
| component | `src/components/test-cases/TestCaseSection.vue` | Replace `.action-link` anchors with `<Button text size="small" icon="pi pi-plus">` — `Add Case` and `Add Subsection`. CSS for `.section-actions` updates to lay out buttons instead of links |
| tests | `tests/e2e/test-cases.spec.ts` (new file) or extend existing | Single case: project with zero suites → empty-state `Add Section` button → opens dialog |
| docs | `docs/01-product/features/002-suite-tree.md` | Note the promoted CTAs |

### Key decisions

- **Two empty-state variants, chosen by `hasAnySuites`.** Today's empty state always says "No test cases yet" + offers `Add Test Case` even when no suites exist — clicking that button leads to an unfillable create dialog. Branching on whether the project has suites at all surfaces the right primary action without forcing the user to discover the sidebar's tiny `+`.
- **Buttons, not anchor tags, for section actions.** PrimeVue `<Button text>` matches the visual language of every other secondary action in the app (Cancel, Back, etc.). Anchor tags conflict with the role gate (`isProjectManager`) — links read as "navigation", buttons read as "do something". Same handlers, same `isProjectManager` gate, no behaviour change.
- **Keep both empty-state CTAs visible at the same time.** The `Add Section` button is primary; `Add Test Case` is secondary and still present so a user who lands on an empty project but has another suite in mind (e.g. they expect bulk import to make one for them) can still get there. The secondary button is `:disabled="!hasAnySuites"` with a short tooltip explaining why — "Create a section first".
- **Sidebar `+` becomes labelled.** The button is the only "create top-level section" surface outside the empty state. The label costs a few px of horizontal space in the header — well worth the discoverability win. Tooltip stays for icon-recognition / accessibility.
- **No new `data-testid`s.** Existing handlers stay reachable through their current selectors. The new section-action Buttons inherit the same emit names, so `TestCaseTreeView.vue` and `TestCaseListView.vue` don't change their event wiring.

---

## Tasks

### Implementation
- [x] `src/components/test-cases/TestCaseTreeView.vue`:
  - [x] Add `hasAnySuites` computed (`suiteTree.length > 0`)
  - [x] Rewrite empty-state markup: primary CTA picks `Add Section` when `!hasAnySuites`, else `Add Test Case`; secondary CTA shows the other and is `:disabled="!hasAnySuites"` when secondary is `Add Test Case`
  - [x] Promote the sidebar `+` Button to `label="Add Section"` with a leading icon; keep aria-label + tooltip
- [x] `src/components/test-cases/TestCaseSection.vue`:
  - [x] Replace the two `.action-link` anchors with `<Button text size="small">` ("Add Case", "Add Subsection")
  - [x] Adjust `.section-actions` CSS for button spacing (drop the `|` divider)

### Tests
- [x] Playwright case: a project with zero suites → empty-state primary button reads `Add Section` and opens the create-section dialog

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/002-suite-tree.md` — note empty-state and sidebar promotions
- [x] `docs/08-decisions/changelog.md` — plan-094 entry
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Sidebar header label wraps on narrow viewports, pushing the close button off-screen on mobile | Low | The mobile breakpoint hides the suite panel; on tablet+ widths the panel is fixed at ≥ 260px, enough for "Add Section". Existing e2e covers the narrow case |
| `Add Test Case` secondary CTA in the no-suites state is misleading if it's `:disabled` with no explanation | Low | Tooltip on hover ("Create a section first") + matching disabled cursor; matches PrimeVue's standard pattern |
| Test selectors that rely on `.action-link` break | Very low | The action-links have no `data-testid` today; tests use the parent component's handlers via the create dialog dropdowns, not the action-link itself |

---

## Definition of done

- [x] On a project with no suites, the test-cases page empty state shows `Add Section` as the primary CTA and `Add Test Case` (disabled) as the secondary
- [x] On a project with suites but no cases, the empty state shows `Add Test Case` primary + `Add Section` secondary
- [x] The sidebar suite-tree header shows a labelled `Add Section` button instead of the tooltip-only `+`
- [x] Inside any section, the bottom action row uses PrimeVue Buttons for `Add Case` / `Add Subsection`, with the same handlers and role gate
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Playwright e2e covers the empty-state primary CTA
- [x] Feature doc + changelog updated
- [x] TES-73 marked Done in Linear with the merge commit linked
