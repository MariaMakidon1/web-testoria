# Execution Plan: Center the initial letter in the `AppHeader` user avatar

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

In `AppHeader.vue` → `.header-right` → `.user-section`, the PrimeVue `.p-avatar.p-avatar-circle` renders the user's initial letter visibly off-center (typically shifted up-left). Fix the letter to sit in the exact center of the circle, both horizontally and vertically, in light and dark mode.

---

## Context

`src/components/common/AppHeader.vue:130-145`:

```vue
<Avatar
  :label="authStore.user?.full_name?.charAt(0) || authStore.user?.username?.charAt(0) || 'U'"
  shape="circle"
  ...
/>
```

PrimeVue renders this as:

```html
<div class="p-avatar p-component p-avatar-circle">
  <span>U</span>           <!-- unstyled text node, inherits line-height -->
</div>
```

The default PrimeVue styles put the span inside a flex container, but the inherited font metrics (body `line-height`, default `vertical-align: baseline`) leave the glyph optically off-center — more pronounced for letters with a short cap height vs the circle's visual center. The existing dark-mode rules (`src/assets/styles/main.css:1325-1331`) only touch color, not layout.

No other avatar on the app depends on this specific styling — the header avatar is the only visible instance today — so a scoped override on `.user-section :deep(.p-avatar.p-avatar-circle)` is the tightest fix.

---

## Scope

### In scope (file: `src/components/common/AppHeader.vue`)

- Scoped CSS rule on `.user-section :deep(.p-avatar.p-avatar-circle)`:
  - `display: inline-flex`
  - `align-items: center`
  - `justify-content: center`
  - `line-height: 1`
  - `font-weight: 500` (optional, matches the header's visual weight — verify against current design)
- Scoped rule on the inner `span` the avatar renders: `line-height: 1; display: block;` to neutralise inherited metrics
- Visual parity check in light and dark mode
- Visual check against an initial with a descender (`g`, `p`, `q`, `y`) — these most often break a naive vertical center; confirm the fix holds
- Unit / snapshot update if any existing `AppHeader.spec.ts` asserts on the avatar's DOM shape

### Out of scope

- Any change to other PrimeVue avatar instances elsewhere (global selector would be broader and invite regressions in future pages that use the component)
- Replacing the avatar with a custom component
- Rendering a user photo instead of the initial — separate feature
- Font-family / font-size changes beyond what's required to center the glyph
- Changing the avatar size or shape (`shape="circle"` stays)
- Any change to the keyboard / ARIA behaviour on the avatar (already correct)
- Changes to `src/assets/styles/main.css` — the scoped file is the correct home; global overrides logged as follow-up if another consumer arrives

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/common/AppHeader.vue` | Add two scoped rules under the existing `<style scoped>` block: one on the avatar container, one on its inner span |
| tests | `tests/unit/components/AppHeader.spec.ts` (if present) | No functional assertions need changing; refresh any snapshot |

### Key decisions

- **`:deep()` over global selectors.** A global `.p-avatar.p-avatar-circle { justify-content: center; }` would also style badges, comment threads, or any future usage that might intentionally position differently. Scoping to `.user-section` keeps the blast radius to the one component that currently needs the fix.
- **`line-height: 1` on both container and inner span.** The container alone isn't enough when the browser treats the span as an inline baseline; neutralising on both sides eliminates the optical drift from font leading.
- **No `transform: translateY(…)` hacks.** Cap-height vs x-height optical centering is a deeper rabbit hole; `line-height: 1` + flex centering is accurate enough for single uppercase glyphs at the header avatar's size. If product wants pixel-perfect optical centering later, that's a typography tuning follow-up.
- **No new CSS variable introduced.** The override is two layout rules; adding a `--avatar-line-height` token for a one-off isn't worth the indirection.
- **Preserve the dark-mode color rules** in `main.css:1325-1331` — they're orthogonal to this change and keep working.

---

## Tasks

### Implementation
- [ ] Capture a before-screenshot of the header avatar in light and dark mode for the PR description
- [ ] Add to `<style scoped>` in `AppHeader.vue`:

  ```css
  .user-section :deep(.p-avatar.p-avatar-circle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  .user-section :deep(.p-avatar.p-avatar-circle > *) {
    line-height: 1;
    display: block;
  }
  ```

- [ ] Verify with the initials `U`, `A`, `g`, `M`, `W` that the glyph sits in the circle's visual center
- [ ] Verify in both light and dark themes
- [ ] Verify at the mobile breakpoint (the existing responsive block at line 278 wraps `.user-section`)
- [ ] Capture an after-screenshot
- [ ] Refresh any snapshot in `tests/unit/components/AppHeader.spec.ts` if the rendered DOM / class order shifts
- [ ] Manual sanity check: hover + keyboard focus ring on the avatar still render (the `role="button"` + focus styles are unchanged)

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build`
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/08-decisions/changelog.md` — record: centered the initial letter in the header user avatar (scoped CSS override)
- [ ] `docs/04-execution/tech-debt.md` — log follow-up: (a) if additional PrimeVue avatar instances land, consider a shared util-class or a tiny wrapper component; (b) optical centering for glyphs with descenders if design asks
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Scoped `:deep()` selector doesn't override PrimeVue specificity | Low | The rule targets the final rendered class — same specificity as PrimeVue's own base style; confirm in-browser devtools |
| A different initial (e.g. `Ω`, `漢`) renders with a different baseline that still looks off | Low | Out of scope — the app today renders Latin initials; non-Latin is tracked as follow-up if relevant |
| A future feature adds a second avatar on the app that inherits the off-center bug | Expected | Tech debt note suggests extracting a shared rule / component when a second instance arrives |
| Test snapshot churn beyond this file | Low | Only the header avatar's DOM is affected |
| Reducing `line-height` to 1 on the span breaks multi-line badges elsewhere | Low | Rule is scoped to `.user-section` only |

---

## Definition of done

- [ ] Header user-avatar initial letter is visually centered in both light and dark mode
- [ ] Centering holds across initials with different cap/x-height (`U`, `M`, `W`, `g`, `I`)
- [ ] No layout regressions in the rest of `AppHeader` (name label spacing, menu trigger positioning, mobile breakpoint)
- [ ] Scoped rule only — no global CSS changes
- [ ] Snapshot / unit tests updated if affected
- [ ] Docs updated; follow-ups logged
- [ ] PR checklist completed
