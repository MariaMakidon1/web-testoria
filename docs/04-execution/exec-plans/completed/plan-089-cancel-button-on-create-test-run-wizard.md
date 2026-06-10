# Execution Plan: Cancel Button on Every Step of Create Test Run Wizard (TES-72)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Every step of the **Create Test Run** wizard exposes a **Cancel** button in the step's button row. Clicking it abandons the wizard and returns the user to wherever they came from — Project Overview when the wizard was launched from a project (`?projectId=<id>` query is set), the Test Runs list otherwise — using the same `backTarget` derivation already wired up by plan-086 for the page-header back button.

Linear: [TES-72](https://linear.app/testoria/issue/TES-72/test-run-creation-wizard-has-no-cancel-button-on-any-step) — Bug, Medium.

---

## Context

The wizard at `src/views/test-runs/TestRunCreateView.vue` has three `.step-actions` button rows (one per step). Today they hold only forward/backward affordances:
- **Step 1** (`:value="1"`, line 327-335): only `Next`.
- **Step 2** (line 368-393): `Back`, optional `Skip — create without cases`, `Next`.
- **Step 3** (line 468-482): `Back`, `Create Test Run`.

There is no abort affordance anywhere in the step rows. The page-header back button (top-left, plan-086) does navigate away, but it's visually a small text icon-button and reads as "back to where I came from", not "abandon the wizard". The bug report explicitly notes that every other dialog in the app (Add Section, Create Project, EditTestRunDialog, etc.) has a Cancel — the wizard is the lone exception.

The fix is small and additive: place a `Cancel` button on the leftmost edge of each step's button row, routing to the same destination as the page-header back. No new state, no confirmation modal, no behavioural change beyond "the user can leave on purpose now".

---

## Scope

### In scope

- Add a `Cancel` button to each of the three `.step-actions` rows in `TestRunCreateView.vue`. Style: `text severity="secondary"` (matches `EditTestRunDialog`'s Cancel), label `Cancel`, `data-testid="create-cancel-btn"`.
- Place Cancel as the **first** child of each `.step-actions` div. The container uses `justify-content: flex-end` + `gap: 12px`, so Cancel ends up far-left of the right-aligned cluster — visually separated from the forward-flow buttons (Next/Create) by the natural gap, the standard pattern for "escape vs proceed".
- Wire `@click` to a single `handleCancel` function that calls `router.push(backTarget.to)`. Reuses the existing computed (plan-086) so the destination stays in lockstep with the page-header back button — one source of truth for "where does this wizard exit to".
- Playwright: extend the existing `tests/e2e/test-runs.spec.ts` with one case asserting the Cancel button is visible on each of the three steps and that clicking it on Step 2 (with form data filled) returns the user to `/test-runs`.

### Out of scope

- Confirmation modal / "discard unsaved changes?" prompt before exit. Matches what other dialogs do today (none confirm). Worth revisiting if QA reports accidental cancellation; not the bug we're fixing.
- Persisting wizard progress so the user can resume later (URL or localStorage). Out of scope; separate plan if wanted.
- A keyboard shortcut for Cancel (e.g. `Esc`). Worth doing globally for dialogs/modals/wizards; separate plan.
- Changing the page-header back button's label or position. It stays as the secondary "I came from somewhere" affordance.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/test-runs/TestRunCreateView.vue` | Add `handleCancel` (one line, `router.push(backTarget.to)`); add three `<Button label="Cancel" ...>` instances, one per `.step-actions` row, each as the first child |
| tests | `tests/e2e/test-runs.spec.ts` | Add a case asserting Cancel is visible on every step and exits to `/test-runs` from the runs-list entry path |
| docs | `docs/01-product/features/005-test-run-planning.md` | Note the Cancel affordance + that its destination mirrors the page-header back via the shared `backTarget` |

### Key decisions

- **Reuse `backTarget`, don't add a second routing source.** plan-086 already established `backTarget` as the single computed for "exit destination". Cancel and the page-header back agree on where to go — if a future entry path adds a new context (say `?from=...`), updating `backTarget` updates both buttons at once.
- **No confirmation dialog.** Matches every other Cancel in the app (`EditTestRunDialog`, project create/edit, etc.). Adds friction to a fix whose purpose is *less* friction. If accidental cancellations become a QA observation later, add a confirmation only when `form.name || selectedCaseIds.size > 0`.
- **Cancel as the first child of `.step-actions`.** With `justify-content: flex-end`, that places it on the far left of the right-aligned button cluster — physically separated from the forward-flow buttons by the row's gap and the empty space. Standard "escape vs proceed" arrangement.
- **`text severity="secondary"` style.** Same visual weight as the `Back` button (also `text`), so Cancel reads as a non-primary action. Matches `EditTestRunDialog`'s Cancel. Keeps the Step 3 `Create Test Run` primary button visually dominant.
- **Single `data-testid="create-cancel-btn"` selector across all three steps.** PrimeVue + Vue render only the visible step's children, so a `page.locator('[data-testid="create-cancel-btn"]')` always resolves to the active step's Cancel — no need for per-step suffixes.

---

## Tasks

### Implementation
- [x] In `src/views/test-runs/TestRunCreateView.vue`:
  - [x] Add `function handleCancel() { router.push(backTarget.to) }` near `handleCreate`
  - [x] Insert a `<Button data-testid="create-cancel-btn" label="Cancel" text severity="secondary" @click="handleCancel" />` at the start of each `.step-actions` row (3 places)
- [x] Spot-check by opening `/test-runs/create` and `/test-runs/create?projectId=<id>` in dev, walking Step 1 → 2 → 3 and confirming Cancel returns to the right place from each

### Tests
- [x] In `tests/e2e/test-runs.spec.ts`: a case that
  - [x] Visits `/test-runs/create` from `/test-runs`
  - [x] Asserts Cancel visible on Step 1; advances to Step 2; asserts Cancel still visible
  - [x] Clicks Cancel on Step 2 with form data filled; asserts URL is `/test-runs`

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/005-test-run-planning.md` — note the Cancel affordance and shared `backTarget` exit destination
- [x] `docs/08-decisions/changelog.md` — plan-089 entry: Cancel buttons added to wizard, exit reuses `backTarget`
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Three Cancel buttons + Skip + Next/Back creates a crowded button row on Step 2 | Low | Step 2 already has up to three buttons; adding a fourth on the far-left edge is visually contained by the `gap: 12px` and `justify-content: flex-end`. If it feels crowded in dev, drop the Step 2 Cancel under the `Back` button which is also a text-style left-side affordance |
| User loses unsaved data without warning | Medium | Acceptable — matches every other dialog in the app. Surface as a follow-up only if QA reports an actual incident; pre-emptive confirmation adds the friction the bug fix is trying to remove |
| `backTarget` drift if a future plan changes its derivation | Very low | Single source of truth; both Cancel and the header back consume it. Tests cover both destinations |
| Playwright case is brittle if visible Cancel selector matches other Cancel buttons on the page | Very low | The wizard is on its own route (`/test-runs/create`); no other modal is open. The data-testid is unique within the view |

---

## Definition of done

- [x] Cancel button is visible on Steps 1, 2, and 3 of `/test-runs/create`
- [x] Clicking Cancel returns the user to the same destination as the page-header back button (`/projects/<id>` from project-overview entry, `/test-runs` otherwise)
- [x] No confirmation modal, no behavioural change to Next/Back/Skip/Create
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Playwright e2e covers visibility on every step and a successful exit
- [x] Feature doc + changelog updated
- [x] TES-72 marked Done in Linear with the merge commit linked
