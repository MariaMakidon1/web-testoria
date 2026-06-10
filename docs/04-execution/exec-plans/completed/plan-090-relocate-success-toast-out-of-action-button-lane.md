# Execution Plan: Relocate PrimeVue Success Toast Out of the Action-Button Lane (TES-74)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Action-feedback toasts ("Project created", "Saved", etc.) appear at **`bottom-right`** instead of `top-right`, so they no longer overlap the **New Test Suite** / **New Test Run** / **Edit** / **Create** primary action buttons that live in the top-right of every list/detail header. Clicks on those buttons are no longer absorbed by the toast for the ~5 seconds it's visible.

Linear: [TES-74](https://linear.app/testoria/issue/TES-74/success-toast-covers-primary-action-buttons-for-5-seconds-after) — Bug, Medium.

---

## Context

`src/App.vue:27` mounts a global `<Toast />` from `primevue/toast` with **no `position` prop** — PrimeVue's default is `top-right`. Every action confirmation in the app routes through `useToast().add(...)` (~50 call sites: project create/update, suite create, test case save, run create, comment save, attachment upload, etc.) and lands in that top-right corner — exactly where the primary action buttons live (page-header `<Button>`s in `ProjectDetailView`, `TestCaseListView`, `TestRunListView`, `TestRunDetailView`, etc.). The toast's container has `pointer-events: auto` (PrimeVue default — needed so users can click the toast to dismiss), so during its ~5s display the underlying buttons cannot be clicked.

A separate component, `src/components/common/NotificationToast.vue`, also lives at top-right (`position: fixed; top: 20px; right: 20px`) but explicitly sets `pointer-events: none` on its container (line 90) — clicks pass through, so it is **not** part of this bug. It also stays where it is; this plan only touches the PrimeVue `<Toast />`.

The fix is a one-prop change in `App.vue`. PrimeVue's Toast supports `position="bottom-right"` natively; no CSS override needed. The `bottom-right` lane is empty in every view in the app (no fixed-position controls there), so the toast won't conflict with anything else.

---

## Scope

### In scope

- `src/App.vue`: change `<Toast />` to `<Toast position="bottom-right" />`. One line.
- Verify by spot-check in dev that:
  - "Project created successfully" toast appears bottom-right after creating a project.
  - The **New Test Suite** / **New Test Run** buttons on the project detail page are clickable while the toast is visible.
  - The toast still auto-dismisses on its existing timer (3-5s, set per-call in the service code; not changing here).
  - On narrow viewports (mobile), the toast doesn't push critical UI off-screen — PrimeVue's bottom-right toast respects `max-width` and stacks vertically; visual regression unlikely.
- E2E sanity: extend an existing test (e.g. `tests/e2e/test-runs.spec.ts` create-run flow) to assert that a `.p-toast` container exists at the bottom of the viewport rather than the top after a successful create.

### Out of scope

- Changing the toast's auto-dismiss duration (`life: N` per call). The bug is the position, not the duration.
- Refactoring the `useToast`/`NotificationToast` split into a single notification system. Worth doing eventually; out of scope for the bug fix.
- Adding a global "click outside to dismiss" or a manual dismiss button on every toast — PrimeVue's default close affordance already exists.
- Moving `NotificationToast` (the realtime-notifications component). It already passes clicks through via `pointer-events: none` on the container; it's not the offender.
- Per-call position overrides (e.g., always show error toasts top-center). The reporter asked for one consistent non-overlapping lane.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/App.vue` | `<Toast />` → `<Toast position="bottom-right" />` |
| tests | `tests/e2e/test-runs.spec.ts` (or similar) | Assert the post-create toast container appears at the bottom of the viewport |
| docs | `docs/01-product/features/<feature with toast UX>.md` (if any) | If a doc references the toast lane, update it |
| docs | `docs/02-architecture/frontend/structure.md` (or similar) | If a doc lists the global app shell components, note the toast position |

### Key decisions

- **`bottom-right`, not `top-center` or `bottom-center`.** Bottom-right is the modern convention (Linear, GitHub, Slack) and the lane is empty in every existing view. `top-center` would cover the page title; `bottom-center` would float over centered content like dialog overlays and is non-standard.
- **Single prop, no CSS override.** PrimeVue's `position` prop emits the right `.p-toast-bottom-right` class with built-in fixed positioning. Adding scoped CSS would risk drifting from PrimeVue's responsive defaults.
- **Don't touch `NotificationToast`.** It's a different system, already pointer-events-transparent. Two top-right islands aren't ideal long-term but the bug is specifically about clicks being absorbed; moving the action toast out of the click path solves it without touching the realtime-notification UX.
- **No per-call `pt:root:style` override.** Could pass `pt:root:style="{ pointerEvents: 'none' }"` on each `useToast().add(...)` call to make the toast click-through, but that breaks click-to-dismiss and would still leave the toast visually overlapping the buttons. Relocation is cleaner.
- **No new wrapper around `useToast`.** All ~50 call sites continue calling `toast.add({ severity, summary, detail, life })` exactly as before. Only the visual lane changes; the API surface is untouched.

---

## Tasks

### Implementation
- [x] In `src/App.vue`: `<Toast />` → `<Toast position="bottom-right" />`
- [x] Spot-check by running dev server, creating a project, and clicking **New Test Suite** while the success toast is visible

### Tests
- [x] In `tests/e2e/test-runs.spec.ts` (or a new `tests/e2e/toast-position.spec.ts`): after creating a run, assert that any `.p-toast` element renders in the bottom half of the viewport (`page.locator('.p-toast').boundingBox()` y > viewport height / 2)

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/08-decisions/changelog.md` — plan-090 entry: relocate PrimeVue Toast to bottom-right to clear the action-button lane
- [x] If any feature doc references "toast in the top-right corner", update it
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A new view adds a fixed-position bottom-right control (chat widget, scroll-to-top button) and re-creates the same overlap | Low | None today. Add a comment in `App.vue` explaining the rationale so future contributors know not to put a button in that lane |
| Mobile / narrow-viewport stacking changes (toast pushes content above the keyboard or off-screen) | Low | PrimeVue's bottom-right is responsive; toast width caps and stacks. If a mobile issue surfaces, switch to `bottom-center` or add a media-query |
| Users reading top-down miss the toast at the bottom | Low | The bug report explicitly suggests bottom-right; matches user mental model from other tools. If discoverability becomes an issue later, switch to `top-center` (still out of the action-button lane) |
| Snapshot tests assert `.p-toast-top-right` class | Very low | Repo grep returns nothing matching that class in tests |
| Two top-right toast systems remain (bug is fixed, but the realtime `NotificationToast` is still top-right) | Acceptable | NotificationToast is pointer-events-transparent — not part of the bug. Long-term unification is filed as a follow-up if QA cares |

---

## Definition of done

- [x] Action-feedback toasts appear at `bottom-right`
- [x] **New Test Suite** / **New Test Run** / **Edit** / **Create** buttons remain clickable while a success toast is visible
- [x] All ~50 `useToast` callers continue working unchanged
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] E2E asserts toast renders in the bottom half of the viewport
- [x] Changelog entry added
- [x] TES-74 marked Done in Linear with the merge commit linked
