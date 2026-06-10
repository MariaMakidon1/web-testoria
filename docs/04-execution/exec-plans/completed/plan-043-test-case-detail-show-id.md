# Execution Plan: Show Test Case ID Before Title on Detail Page

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Display the test case primary key (e.g. `#142`) immediately before the title in the page header of `TestCaseDetailView.vue`, so users can quickly read and reference the canonical id of the case they are looking at.

---

## Context

On `/test-cases/:id`, the page header currently shows only the test case title (`TestCaseDetailView.vue:81–83`). Users (testers and leads) routinely need to reference cases by their numeric id when filing defects, talking in chat, or pasting into CI logs, and today they have to read it from the URL bar. Showing the id beside the title makes it copy-pasteable and visually unambiguous which case is open.

The id is already available on the frontend: the test case store loads `currentTestCase` from `getTestCase(id)`, and `TestCaseResponse` in the backend already includes `id: int` (`api-testoria/app/schemas/test_case.py:39`). **No backend changes are needed.**

---

## Scope

### In scope
- Render the id as a prefix on the detail page `<h1>` (e.g. `#142  My case title`)
- Style it as a muted/secondary token so it reads as metadata, not part of the title text
- Keep the existing `v-if` guard on `currentTestCase` so the prefix never renders without a value

### Out of scope
- Showing the id on the list view, editor, defects table, or any other page (separate decisions if requested)
- Changing the URL scheme or adding a slug
- Backend changes — `id` is already in the response
- Copy-to-clipboard affordance on the id (nice-to-have; defer until requested)
- i18n of the `#` prefix

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-cases/TestCaseDetailView.vue` | Add `<span class="test-case-id">#{{ currentTestCase.id }}</span>` before the title text inside the existing `<h1>`; add a small CSS rule for `.test-case-id` |

### Key decisions

- **Prefix format**: `#<id>` (e.g. `#142`). Short, conventional, instantly recognizable as an identifier. Reject `ID: 142` (verbose) and `TC-142` (would imply a separate display key the system does not actually have — misleading).
- **Markup placement**: keep the id inside the same `<h1>` as the title (`h1 > span.test-case-id + text`). Reasons: (a) preserves the existing semantic heading, (b) the id is part of the page's primary identifier, (c) avoids a layout reflow risk from introducing a new flex row.
- **Styling**: muted color (`var(--text-color-secondary)`), same font-size as the title or one step smaller, regular weight, small right margin. The title stays the visual anchor; the id is supporting metadata.
- **No store or API changes** — `currentTestCase.id` is already populated by the existing `loadTestCase` action.

---

## Tasks

### Implementation
- [x] Update the `<h1>` block in `src/views/test-cases/TestCaseDetailView.vue` (lines 81–83) to prefix the title with `<span class="test-case-id">#{{ testCasesStore.currentTestCase.id }}</span>`
- [x] Add a `.test-case-id` rule to the component's `<style scoped>` block (muted color, small right margin)
- [x] Manual visual check: short title, very long title, single-digit id, four-digit id, dark mode

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/test-case-authoring.md` (or the test case detail feature doc, if separate) — note the id-prefix in the page header description
- [x] `docs/08-decisions/changelog.md` — short entry recording the `#<id>` format choice
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map / api-schema / store / tech-debt updates — none of those layers change.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Long titles wrap awkwardly next to the id | Low | Use inline-block on `.test-case-id` and let the title wrap; visual check both narrow and wide viewports |
| The muted color clashes in dark mode | Low | Use `var(--text-color-secondary)` so it follows the theme tokens already used elsewhere |
| Future requests to show the id elsewhere create inconsistency | Low | The chosen `#<id>` format is documented in the changelog so later additions can match |

---

## Definition of done

- [x] On `/test-cases/:id`, the page header shows `#<id>` before the title in a muted style
- [x] Layout works for short and long titles, single- and multi-digit ids, in light and dark mode
- [x] No regressions in the back button, edit button, or delete button alignment
- [x] PR checklist completed
- [x] Feature doc and changelog updated
