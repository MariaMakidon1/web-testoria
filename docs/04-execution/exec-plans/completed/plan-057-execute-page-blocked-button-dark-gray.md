# Execution Plan: Recolor the Blocked button on `/test-runs/:id/execute` to dark gray

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Make the "Blocked" verdict button on the test-run execution page (`/test-runs/:id/execute`) render in the dark-gray `--status-blocked` token instead of PrimeVue's amber `severity="warning"`, so the button matches the badge, progress segment, and export color set by plan-048.

---

## Context

Plan-048 recolored the `blocked` status everywhere the CSS token / TS constant / export maps are consulted. But `TestRunExecutionView.vue:898-904` uses a raw PrimeVue `<Button severity="warning">`, which pulls the amber PrimeVue theme color directly — it never reads the `--status-blocked` token:

```vue
<Button
  label="Blocked"
  icon="pi pi-ban"
  severity="warning"
  :loading="isSubmitting"
  @click="submitResult('blocked')"
/>
```

Result: on `/test-runs/:id/execute`, the button is amber, but the resulting row's badge, the progress segment, and the PDF/Excel cell are dark gray. The mismatch is most visible when the user clicks "Blocked" and sees the row flip colors.

The neighboring buttons have the same issue by proxy:
- `Passed` → `severity="success"` (OK — matches `--status-passed` intent; but still bypasses the token)
- `Failed` → `severity="danger"` (same)
- `Skipped` → `severity="secondary"` (happens to map to light gray on the current PrimeVue theme; still bypasses the token)

This plan addresses only the Blocked button, because that's the regression the user reported. A follow-up can align the other three buttons to the tokens if desired.

---

## Scope

### In scope
- Replace the PrimeVue `severity="warning"` on the Blocked button with a styled button that uses `var(--status-blocked)` as its background, matching the badge color
- Ensure the styled button preserves:
  - Loading spinner (`:loading="isSubmitting"`)
  - Icon (`pi pi-ban`)
  - Label ("Blocked")
  - Hover / active / focus states (with an accessible focus ring)
  - Disabled state while another verdict is submitting
- Text color on the dark-gray background passes WCAG AA (likely `#fff`)
- Dark-mode rendering checked (the `--status-blocked` token already has a dark-mode override from plan-048 if present)
- Unit / snapshot test in `TestRunExecutionView.spec.ts` (or a small DOM test) asserts the Blocked button has class / style referencing the blocked token, not `p-button-warning`
- Manual visual check on the running dev server in light and dark mode

### Out of scope
- Recoloring the Passed / Failed / Skipped buttons (can be a follow-up)
- Changing `--status-blocked` itself — plan-048 owns the token value
- Changing the step-status picker (plan-047 already uses tokens)
- Any backend change
- Any change to the Blocked badge/chip/progress — those already use the token

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/views/test-runs/TestRunExecutionView.vue` | Remove `severity="warning"` on the Blocked button; add a scoped class (e.g. `.verdict-btn--blocked`) that sets `background: var(--status-blocked)`, `color: #fff`, hover/active shades, and a matching focus ring. Keep PrimeVue `<Button>` for loading + icon handling — `severity="contrast"` or `unstyled` + scoped CSS, whichever produces fewer overrides |
| styles | same file (scoped `<style>`) | New rule for `.verdict-btn--blocked` and `:hover` / `:active` / `:focus-visible` |
| tests | `tests/unit/views/TestRunExecutionView.spec.ts` (or existing test file) | Assert the Blocked button renders with the blocked class and not `p-button-warning` |

### Key decisions

- **Scoped class over theming the PrimeVue severity**. Overriding `p-button-warning` globally would change every warning button in the app (filters, badges, other forms). A scoped class keeps the blast radius to this button only.
- **Reuse the existing CSS token (`--status-blocked`)**. Don't introduce a new variable. If plan-048 didn't define the hover/active shades as tokens, derive them inline via `color-mix()` or a fixed darker shade; document the choice.
- **Keep `<Button>` from PrimeVue** for the loading spinner + icon slot; only override the color via `:pt` (pass-through) or a wrapping class. Avoid hand-rolling a `<button>` element — loses accessibility affordances the PrimeVue component already provides.
- **No change to the submit action**. The click still calls `submitResult("blocked")`; only the appearance changes.

---

## Tasks

### Implementation
- [ ] Inspect `/test-runs/:id/execute` in both themes to capture the current amber button as a before-state screenshot
- [ ] Add `.verdict-btn--blocked` in the component's scoped style block using `var(--status-blocked)`, white text, hover (~8% darker) and active (~15% darker) states, plus a `:focus-visible` ring
- [ ] Swap `severity="warning"` → apply the class via `:class` / `pt` on the Blocked `<Button>`; keep `:loading` and `icon` untouched
- [ ] Verify disabled state while `isSubmitting` still looks disabled (reduce opacity / block pointer events)
- [ ] Unit test: mount the view, find the Blocked button, assert class membership and absence of `p-button-warning`
- [ ] Manual visual check: light + dark mode; keyboard focus; screen reader announces "Blocked" unchanged
- [ ] Contrast check: `#fff` text on `--status-blocked` ≥ 4.5:1

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build` (vue-tsc)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/08-decisions/changelog.md` — note: Execute page's Blocked button now reads the `--status-blocked` token (alignment follow-up to plan-048)
- [ ] `docs/04-execution/tech-debt.md` — log: align the Passed / Failed / Skipped verdict buttons to their status tokens (follow-up)
- [ ] `docs/01-product/features/006-test-execution.md` — if it enumerates button styling, update the Blocked entry
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Scoped style doesn't override PrimeVue specificity, button stays amber | Medium | Use `!important` only as a last resort; prefer PrimeVue `pt` (pass-through) props or a `:deep()` selector targeting `.p-button` inside the scoped style |
| Dark-mode token override looks washed out with white text | Low | Verify contrast in both themes; if dark-mode `--status-blocked` is too light, use `color-mix(in oklch, var(--status-blocked), black 15%)` for the dark-mode button bg |
| Focus ring disappears after the override | Low | Explicit `:focus-visible { outline: 2px solid var(--focus-ring) }` rule added |
| Loading spinner color becomes invisible on gray | Low | Spinner inherits `currentColor`; with white text the spinner stays white |
| A future PrimeVue upgrade changes `p-button-warning` specificity and leaks amber back | Low | The override targets `.verdict-btn--blocked`, not `p-button-warning`; independent of upgrade churn |

---

## Definition of done

- [ ] Blocked button on `/test-runs/:id/execute` renders with `--status-blocked` background and white (or token-driven) text
- [ ] Hover, active, focus, disabled, and loading states all behave correctly
- [ ] Clicking still submits `blocked`; no behaviour change
- [ ] Unit test asserts the button no longer uses `p-button-warning`
- [ ] Light-mode and dark-mode visually confirmed
- [ ] Contrast ≥ WCAG AA
- [ ] Docs updated
- [ ] PR checklist completed
