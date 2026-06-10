# Execution Plan: 013 — Accessibility

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Document and expose the keyboard shortcuts composable, add `data-testid` attributes for stable e2e test selectors, and add a keyboard shortcut help dialog accessible from the UI.

---

## Context

Analysis found a `useKeyboardShortcuts` composable in `useAccessibility.ts` that is fully implemented but completely undocumented and not surfaced in the UI. Users have no way to discover available shortcuts. Additionally, existing e2e tests rely on CSS class and ID selectors (`#username`, `.p-toast-message-error`) that are fragile — `data-testid` attributes were flagged as a follow-up item in the completed Track A+B plan.

---

## Scope

### In scope
- Document `useKeyboardShortcuts` API in `docs/01-product/features/013-accessibility.md`
- Add a keyboard shortcut help dialog (`KeyboardShortcutsDialog.vue`) — opens via `?` key or a help button in the header; lists all registered shortcuts
- Add `data-testid` attributes to the 20 most critical interactive elements across login, test run creation, and execution views (aligning with existing e2e test selectors)

### Out of scope
- User-configurable keybindings (deferred)
- Screen reader testing with real assistive technology (requires manual QA session)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| composables | `src/composables/useAccessibility.ts` | No code changes — document existing `useKeyboardShortcuts` API |
| components | `src/components/common/KeyboardShortcutsDialog.vue` | New — reads registered shortcuts from `useKeyboardShortcuts` and renders them in a two-column table |
| components | `src/components/common/AppHeader.vue` | Add `?` key listener to open shortcuts dialog; add help icon button |
| views | `src/views/LoginView.vue`, `TestRunCreateView.vue`, `TestRunExecutionView.vue` | Add `data-testid` attributes to key interactive elements |
| tests | `tests/e2e/login.spec.ts`, `test-runs.spec.ts`, `test-execution.spec.ts` | Update selectors to use `data-testid` |

### Key decisions

- The shortcuts dialog is a PrimeVue `Dialog` with `modal: true`. It is registered globally via `AppHeader` so the `?` key works app-wide.
- `data-testid` values follow the pattern `<feature>-<element>` (e.g. `login-submit`, `execution-status-select`). They are added as HTML attributes — not class names — so they survive CSS refactors.

---

## Tasks

### Implementation
- [ ] Create `KeyboardShortcutsDialog.vue`
- [ ] Add `?` key handler and help button to `AppHeader`
- [ ] Add `data-testid` attributes to Login, TestRunCreate, TestRunExecution views
- [ ] Update e2e test selectors to use `data-testid`

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run test:e2e` passes with updated selectors
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/013-accessibility.md` updated (keyboard shortcuts documented)
- [ ] `docs/03-engineering/testing/e2e.md` updated — note `data-testid` convention
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `?` key conflicts with PrimeVue component internal shortcuts | Low | Check PrimeVue Dialog and DataTable for conflicting shortcuts before registering |
| Updating e2e selectors may break tests before `data-testid` is added | High | Add `data-testid` attributes before updating test selectors (same PR) |

---

## Definition of done

- [ ] `?` key opens the shortcuts help dialog from any page
- [ ] All existing e2e tests pass using `data-testid` selectors
- [ ] `useKeyboardShortcuts` is documented in the feature doc
