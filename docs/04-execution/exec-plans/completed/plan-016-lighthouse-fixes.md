# Execution Plan: Lighthouse Performance & Quality Fixes

**Date**: 2026-03-25
**Author**: Claude
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Raise Lighthouse scores from Performance 65, Accessibility 87, SEO 90, Best Practices 96 to meet or exceed CI thresholds (Performance ≥ 70, Accessibility ≥ 90, SEO ≥ 80, Best Practices ≥ 90) and eliminate the CI-blocking accessibility error.

---

## Context

A Lighthouse 12.6.1 audit was captured on 2026-03-25 (`localhost_2026-03-25_12-06-05.json`) against the login page. Two scores are currently failing their `.lighthouserc.json` thresholds:

- **Accessibility 87 < 90** — CI assertion is `error` (blocks merge)
- **Performance 65 < 70** — CI assertion is `warn`

Root issues are specific and actionable: a missing favicon, a missing meta description, invalid ARIA attributes from PrimeVue's Password component, a low-contrast button label, and ~469 KiB of JavaScript being fetched-but-unused on the login page because Vite emits `<link rel="modulepreload">` for every chunk including on-demand export libraries.

---

## Scope

### In scope
- Fix favicon 404 (console errors, Best Practices)
- Add `<meta name="description">` to `index.html` (SEO)
- Fix `aria-expanded` / `aria-haspopup` on PrimeVue Password input (Accessibility)
- Fix color contrast on login submit button label (Accessibility)
- Suppress modulepreload for on-demand chunks — `excel`, `pdf`, `editor` (Performance)
- Fix legacy-JS polyfills by applying esbuild `target: 'esnext'` to optimized deps (Performance)
- Update `.lighthouserc.json` thresholds to reflect realistic targets post-fix

### Out of scope
- BF-cache failure ("Internal error / Not actionable") — not fixable in app code
- Source maps in production build — intentionally disabled, documented trade-off
- Render-blocking CSS — Vite SPA limitation; savings are only 322 ms + 172 ms and inlining critical CSS would require a custom plugin with disproportionate complexity
- Achieving FCP < 1.8 s on simulated mobile — requires SSR or pre-rendering, outside current architecture

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| static | `public/favicon.svg` | Create SVG favicon (no public dir exists yet) |
| html | `index.html` | Add `<meta name="description">`, update `<link rel="icon">` to `.svg` |
| view | `src/views/auth/LoginView.vue` | Use PrimeVue PassThrough `pt` prop to strip invalid ARIA attrs from Password input; override button text color for contrast |
| build | `vite.config.ts` | Add `build.modulePreload.resolveDependencies` to exclude on-demand chunks; add `optimizeDeps.esbuildOptions.target: 'esnext'` |
| ci | `.lighthouserc.json` | Raise performance threshold to 0.75, accessibility to 0.92 once fixes land |

### Key decisions

- **PassThrough API for ARIA fix**: PrimeVue 4 exposes a `pt` prop on every component that allows injecting/overriding HTML attributes on internal DOM elements. Using `pt` keeps the fix local to `LoginView.vue` without patching the library or wrapping the component.
- **`resolveDependencies` for modulepreload**: Vite's `build.modulePreload.resolveDependencies` callback receives `(filename, deps, context)` and returns the filtered list of deps to preload. Returning an empty array for the `index` entry point for chunks named `excel`, `pdf`, `editor` stops them appearing as `<link rel="modulepreload">` in the HTML without disabling preloading for genuinely needed chunks.
- **SVG favicon**: Simpler than generating a `.ico`, supported by all modern browsers, and avoids adding a binary blob to the repo.
- **Color contrast**: The failing node is `span.p-button-label` inside the login submit button. PrimeVue's default primary button uses `var(--p-button-primary-color)` for the label. Override it in `.login-card` scope so only the login button is affected; no global style change.

---

## Tasks

### Implementation

- [x] Create `public/favicon.svg` — simple "T" lettermark in brand color
- [x] Update `index.html`: add `<meta name="description">`, fix `<link rel="icon">` href to `/favicon.svg`
- [x] Fix ARIA in `LoginView.vue`: add `pt` prop to `<Password>` to remove `aria-expanded` and `aria-haspopup` from the internal input
- [x] Fix color contrast in `LoginView.vue`: add CSS override so `.login-card .p-button-primary .p-button-label` has sufficient contrast (4.5:1 minimum)
- [x] Update `vite.config.ts`: add `optimizeDeps.esbuildOptions.target: 'esnext'` and configure `build.modulePreload.resolveDependencies` to exclude `excel`, `pdf`, `editor` chunks
- [x] Update `.lighthouserc.json`: raise thresholds to performance 0.75, accessibility 0.92

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (278 tests)
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/04-execution/tech-debt.md` — no new debt introduced; no existing item resolved
- [x] `docs/05-quality/QUALITY_SCORE.md` updated with new Lighthouse scores
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| PrimeVue `pt` API strips attributes that break toggle-mask functionality | Low | Test the password show/hide toggle manually after the change; only strip `aria-expanded` and `aria-haspopup`, not `aria-label` |
| `resolveDependencies` callback API differs across Vite versions | Low | Confirm against installed Vite version before writing; fall back to `modulePreload: false` if API unavailable |
| Color contrast override breaks dark mode | Medium | Scope override to `.login-card` and verify both themes; use a high-contrast explicit colour rather than a CSS variable |
| Performance score stays below 0.70 after fixes | Medium | The unused-JS saving (~480 KiB) is the biggest lever; if score is still low, consider raising the threshold rather than chasing mobile simulation score |

---

## Definition of done

- [x] `favicon.svg` served at `/favicon.svg` — no 404 in console
- [x] `<meta name="description">` present in page `<head>`
- [x] Lighthouse accessibility audit passes with score ≥ 0.90 (no `aria-allowed-attr` or `color-contrast` failures)
- [x] Lighthouse performance score ≥ 0.70
- [x] CI Lighthouse assertions pass (`npm run build && lhci autorun`)
- [x] Unit tests pass
- [x] PR checklist completed
