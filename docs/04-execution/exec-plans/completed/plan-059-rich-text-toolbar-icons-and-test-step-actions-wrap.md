# Execution Plan: Fix missing tiptap toolbar icons and rework test-step action button wrapping

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Make every formatting button on the `RichTextEditor` toolbar visible — Bold / Italic / Strikethrough currently render blank because the icon classes don't exist in PrimeIcons 7 — and redesign the per-step action row in `TestStepsEditor` so the up/down/duplicate/delete buttons don't wrap or squeeze awkwardly when the create-test-case dialog is narrow or when both Action + Expected Result editors are side-by-side.

---

## Context

### Problem 1 — missing toolbar icons

`src/components/common/RichTextEditor.vue` renders the toolbar with PrimeIcons classes: `pi pi-bold`, `pi pi-italic`, `pi pi-strikethrough`. **These classes do not ship with PrimeIcons 7** (pinned at `^7.0.0` in `package.json:35`). When the class is absent, the `<span>` that PrimeVue's `Button` renders for the icon has no glyph, so the button looks empty — the user sees three blank square buttons in the first toolbar group.

The same applies to `pi pi-list-check` (numbered list) — it renders a list-checkmark, not an ordered-list icon; works but semantically wrong. Confirm with a quick visual check.

Other toolbar icons (`pi-code`, `pi-list`, `pi-link`, `pi-window-maximize`, `pi-minus`, `pi-undo`, `pi-refresh`) do exist and render correctly.

### Problem 2 — cramped step actions in the create dialog

`TestStepsEditor.vue` renders each step with:
- A drag handle on the left
- A header row: `Step N` chip + four action buttons (up, down, duplicate, delete) aligned to the right
- Two `RichTextEditor` fields below (Action + Expected) in a 1fr / 1fr grid

When the editor appears inside the create-test-case dialog, horizontal space is limited. The four action buttons are 32 × 32 rounded icons (`:deep(.p-button) { width: 32px; height: 32px; }` from the rich-text-editor styles leak, but TestStepsEditor uses its own Button layouts). They render fine on wide desktop but:
- On mid-width dialogs they push the `Step N` chip left and sometimes wrap under the chip
- The rich-text toolbar above each field ALSO wraps (5 groups × ~4 buttons each = 16+ buttons) — when two editors are side-by-side each toolbar wraps onto 3 lines, making the step card very tall
- `flex-wrap: wrap` on the toolbar fires; the step header has no `flex-wrap` so buttons go off-edge

So both areas need a rethink:
- The rich-text toolbar: fix the missing icons; consider a denser layout that wraps less often (compact button size, tighter spacing, maybe collapse less-used groups into an overflow `Menu`)
- The step header actions: make them wrap predictably or fold into an overflow menu below a width threshold

---

## Scope

### In scope

**Toolbar icons (RichTextEditor)**:
- Replace each missing PrimeIcons class with either (a) an inline SVG glyph for Bold / Italic / Strikethrough (preferred, fully controlled), or (b) text-label buttons styled as typographic markers (**B**, *I*, ~~S~~), or (c) PrimeVue's icon slot pointing to the lucide / custom SVG already bundled elsewhere in the project (confirm what's available)
- Replace `pi-list-check` with a correct ordered-list icon (inline SVG or the closest PrimeIcons match: verify `pi-sort-numeric-up` or use an SVG)
- Keep existing icons that work as-is (`pi-code`, `pi-list`, `pi-link`, `pi-window-maximize`, `pi-minus`, `pi-undo`, `pi-refresh`) — only fix broken ones
- Active-state styling (`.active` class) continues to work with the new icon approach
- Tooltips unchanged

**Toolbar layout** (only if space-related issue is confirmed during visual pass — this is opportunistic, not required):
- Tighter padding (reduce `gap: 4px` on `.editor-toolbar` to `2px` between groups, keep 2px within a group)
- Smaller buttons in dialog contexts (size="small" already present; verify the 32×32 override isn't making them bigger than expected)
- Wrap behaviour stays `flex-wrap: wrap` — no overflow menu in this plan

**Step action row (TestStepsEditor)**:
- On widths ≥ 640px: existing 4 inline buttons (up, down, duplicate, delete), right-aligned
- On widths < 640px: collapse the four buttons into a single `MoreActions` icon button (`pi-ellipsis-v`) that opens a PrimeVue `Menu` with the four actions as menu items; up/down stay inline because they're frequent, duplicate/delete fold into the menu — **decision below**, pick one
- Alternative (simpler): keep all four inline but switch the header to a two-row layout on narrow widths — `Step N` chip on row 1, action buttons on row 2 right-aligned, both with `flex-wrap: wrap`; zero dependency additions
- Pick the simpler alternative; document the `Menu` approach as a follow-up if product still finds it cramped

**Step fields layout**:
- The two-column grid (`grid-template-columns: 1fr 1fr`) already collapses to one column at 768px; keep this threshold
- In the dialog context, the parent sets a narrower effective width — verify the breakpoint triggers inside the dialog; if not, bump the threshold to match the dialog's content width or use a container query

**Tests**:
- Unit: toolbar renders every button with a visible glyph (assert either SVG `viewBox` attr or an aria-label on the button) — this protects against future icon regressions
- Visual check: open the create-test-case dialog at 600px, 768px, 1024px widths; confirm no overlap, no hidden text; screenshots attached to PR

### Out of scope
- Upgrading PrimeIcons (may conflict with PrimeVue 4 theme tokens; separate plan if desired — log as tech debt)
- Swapping tiptap for a different editor
- Adding new formatting features (tables, colour picker, images) to the toolbar
- Changing the editor output format (still emits HTML)
- Reworking the create-test-case dialog itself (only the `TestStepsEditor` usage inside it)
- Keyboard-shortcut coverage for the formatting buttons (already handled by tiptap's StarterKit)
- Accessibility audit of the full editor (narrow-scope aria-label fixes only, below)
- RTL support
- Touch-drag for steps (existing native HTML5 drag stays)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/common/RichTextEditor.vue` | Replace the Bold / Italic / Strikethrough / ordered-list buttons' `icon="pi ..."` with slotted inline SVG content; keep tooltips and `.active` class; add `aria-label` on each button to match the tooltip |
| styles | `src/components/common/RichTextEditor.vue` | Slight layout tightening if confirmed (gap reduction, ensure 28-32px button size); no breaking changes |
| components | `src/components/test-cases/TestStepsEditor.vue` | `.step-header` → `flex-wrap: wrap` with `gap: 8px`; `.step-actions` → `margin-left: auto` so it stays right when wrapped; no other logic changes |
| styles | `src/components/test-cases/TestStepsEditor.vue` | Add a container-width breakpoint (media query or container query) that hides the "duplicate" button's label if one is added (no label today — keep icon-only); verify the 1fr 1fr grid breakpoint |
| tests | `tests/unit/components/RichTextEditor.spec.ts` | Assert each toolbar button has a non-empty aria-label and either a PrimeIcons class or an inline `<svg>` child |
| tests | `tests/unit/components/TestStepsEditor.spec.ts` | Render at a narrow container width (jsdom doesn't really layout, so this is a structural test — verify `step-header` has `flex-wrap: wrap` via a snapshot or class assertion) |

### Key decisions

- **Inline SVGs over a new icon library**. Lucide or Heroicons would solve the problem but add a dependency. Six glyphs (bold, italic, strike, ordered-list, and two doubles-as-backup) inlined in the component are ~200 bytes each, scoped to the editor, and don't touch global CSS. If later plans need more icons repo-wide, that's a bigger conversation.
- **Keep PrimeIcons for everything else**. The working icons (`pi-code`, `pi-list`, `pi-link`, etc.) stay — no need to churn icons that render correctly.
- **Text-label fallback rejected**. "**B**" / "*I*" / "~~S~~" is a common pattern (Google Docs, Notion) but looks inconsistent alongside the pictographic icons for the other groups. Icon-first is the house style.
- **`aria-label` on every toolbar button**. Tooltips (`v-tooltip.top`) are mouse-only; screen-reader users need an accessible label. This plan adds labels to all toolbar buttons, not just the fixed ones, since the audit cost is negligible.
- **Step-header wrap over overflow menu**. Adding a `Menu`-based overflow opens questions (which actions stay visible, keyboard nav, touch targets) that outweigh the fix. Letting the action row wrap to a second line inside `.step-header` is a one-line CSS change and keeps all actions visible at a glance.
- **No PrimeIcons upgrade**. Bumping to PrimeIcons 8+ *might* add `pi-bold` / `pi-italic` but risks pulling in theme conflicts with PrimeVue 4. Not worth it for 3–4 glyphs. Log as tech debt: "evaluate PrimeIcons 8 upgrade across the app".
- **No container queries required**. The existing `@media (max-width: 768px)` breakpoint fires on viewport width, which is imperfect inside a dialog but close enough for the dialog sizes the app actually opens (the dialog respects viewport width on mobile). If the dialog-in-desktop case needs more care, revisit with a container query later — tech debt.
- **Icon consistency with dark mode**. Inline SVGs use `currentColor` for `fill` / `stroke` so they inherit the button's text colour and adapt to dark mode automatically. No extra work.

---

## Tasks

### Implementation

**RichTextEditor toolbar**:
- [ ] Verify which PrimeIcons classes render blank in v7 by loading the dialog in a dev build (candidates: `pi-bold`, `pi-italic`, `pi-strikethrough`, `pi-list-check`)
- [ ] Replace each blank-icon button with an inline `<svg>` (width 14, height 14, `currentColor` stroke/fill, path lifted from a permissive-license icon set — document source in a comment above the SVG block)
- [ ] Keep the `:class="{ active: ... }"` binding; ensure the `.active` style still applies to the button wrapper (not the SVG)
- [ ] Add `aria-label` and keep `v-tooltip.top` on every toolbar button
- [ ] Tighten toolbar gaps if the visual pass shows extra space (only if necessary)
- [ ] Dark-mode visual pass on the toolbar

**TestStepsEditor actions**:
- [ ] Update `.step-header` CSS: `flex-wrap: wrap`, `gap: 8px`; `.step-actions { margin-left: auto }` so it right-aligns whether on the same row or wrapped
- [ ] Visual pass on dialog widths 600 / 768 / 1024px; confirm no overlap, Step N chip never hidden, all four buttons reachable
- [ ] If the two-column `.step-fields` grid still feels cramped inside the dialog, bump the break threshold (e.g. `max-width: 960px`) — only if needed
- [ ] Verify drag-and-drop still works with the wrap change (test dragging a step onto another)

**Tests**:
- [ ] Unit test: render `RichTextEditor`, assert the Bold / Italic / Strikethrough buttons contain an `<svg>` and have the expected `aria-label`
- [ ] Unit test: render `TestStepsEditor` with 3 steps, assert `.step-header` has the new wrap class; snapshot the action buttons' aria-labels
- [ ] Visual: before/after screenshots of the create-test-case dialog toolbar and the step header at 600 / 768 / 1024px

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/07-references/llm/design-system.txt` — add a short "Inline SVGs are the fallback when PrimeIcons lacks a glyph" note
- [ ] `docs/01-product/features/003-test-case-authoring.md` — if it mentions the rich-text toolbar or step editor, update to reflect the fix
- [ ] `docs/08-decisions/changelog.md` — record: inline SVGs for formatting glyphs not in PrimeIcons 7; step header now wraps instead of overflowing; no dependency change
- [ ] `docs/04-execution/tech-debt.md` — log (a) evaluate PrimeIcons 8 upgrade, (b) container queries for editor-in-dialog sizing if revisited
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Inline SVG colour doesn't flip with dark mode | Low | SVGs use `currentColor`; button sets `color` via theme tokens; verified during the dark-mode visual pass |
| Active-state styling (background fill on the button) still applies to a button whose child is an SVG instead of an icon span | Low | `.editor-toolbar :deep(.p-button.active)` targets the button wrapper, not the icon — SVG child is unaffected |
| Tooltip + aria-label produce duplicate announcements for screen readers | Low | PrimeVue tooltip uses `aria-describedby`; aria-label is the primary name — accepted duplication, better than missing name |
| Toolbar becomes too dense after gap reduction; misclicks | Low | Keep button size at 32×32 (current); only reduce inter-group gaps; visual pass catches issues |
| Wrap in `.step-header` pushes the Step N chip under the action buttons | Low | `margin-left: auto` on actions keeps them right; the chip is the first child — wrap puts actions on row 2, chip alone on row 1 |
| Existing drag-and-drop breaks because the step-header now has different layout | Low | Draggability is on `.step-item`, not `.step-header`; drag handle is a separate flex column; change is isolated to the header row |
| Licensing on the copied SVG paths | Low | Use MIT-licensed sources (Feather Icons, Lucide MIT variant, or original author-licensed glyphs); add a one-line attribution comment above the SVG block |
| Unit test brittleness — asserting SVG structure | Low | Assert presence of `<svg>` + `aria-label` only, not internal paths |

---

## Definition of done

- [ ] Bold, Italic, Strikethrough, and ordered-list buttons are visible and clickable in the `RichTextEditor` toolbar
- [ ] Clicking each button toggles the correct formatting in the editor content
- [ ] `.active` state renders correctly on the new icon buttons
- [ ] Every toolbar button has an `aria-label` matching its tooltip
- [ ] The step action buttons (up, down, duplicate, delete) wrap cleanly into a second row when the dialog is narrow; no overlap or clipping
- [ ] The create-test-case dialog renders the step editor cleanly at 600 / 768 / 1024px widths
- [ ] Light and dark mode verified
- [ ] Unit tests pass; visual screenshots attached to the PR
- [ ] No new dependencies
- [ ] Docs updated
- [ ] PR checklist completed
