# Execution Plan: Remove System Theme Option

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-040-remove-system-theme.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Remove the "System" theme option from the settings page and all supporting code, keeping only Light and Dark themes.

---

## Context

The settings page offers three theme options: Light, Dark, and System. The System option detects the OS preference via `prefers-color-scheme` media query and auto-switches. This adds complexity (media query listener, conditional logic in `applyTheme`) and can cause confusion when the theme doesn't match what the user explicitly chose. Simplify to just Light and Dark.

---

## Scope

### In scope

- Remove "System" option from the theme selector in `SettingsView.vue`
- Remove `"system"` from the `theme` type in `preferences.ts`
- Remove the `prefers-color-scheme` media query listener in `preferences.ts`
- Remove the `system` branch in `applyTheme()`
- Change the default theme from `"system"` to `"light"`
- Handle existing users who have `"system"` saved in localStorage — migrate to `"light"` on load

### Out of scope

- Changing the Light or Dark theme styles
- Auto-detect on first visit (could be a future enhancement)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| stores | `src/stores/preferences.ts` | Remove `"system"` from theme type; change default to `"light"`; remove `prefers-color-scheme` listener; simplify `applyTheme`; add migration for existing `"system"` values |
| views | `src/views/settings/SettingsView.vue` | Remove `{ label: "System", value: "system" }` from `themeOptions` array |

### Implementation

**1. `src/stores/preferences.ts`**

Update type (line 6):
```ts
// Before
theme: "light" | "dark" | "system";
// After
theme: "light" | "dark";
```

Update default (line 33):
```ts
// Before
theme: "system",
// After
theme: "light",
```

Simplify `applyTheme` (lines 106-117) — remove the `system` branch:
```ts
function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", preferences.value.theme);
}
```

Remove the `prefers-color-scheme` media query listener (lines 124-132).

Add migration in `loadPreferences` or init — if loaded theme is `"system"`, set to `"light"`:
```ts
if ((preferences.value.theme as string) === "system") {
  preferences.value.theme = "light";
}
```

**2. `src/views/settings/SettingsView.vue`**

Remove line 26:
```ts
const themeOptions = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  // Remove: { label: "System", value: "system" },
];
```

---

## Tasks

### Implementation

- [x] Remove `"system"` from theme type union in `preferences.ts`
- [x] Change default theme to `"light"` in `DEFAULT_PREFERENCES`
- [x] Remove the `if (theme === "system")` branch in `applyTheme()`
- [x] Remove the `prefers-color-scheme` media query listener
- [x] Add migration: if loaded value is `"system"`, set to `"light"`
- [x] Remove `{ label: "System", value: "system" }` from `themeOptions` in `SettingsView.vue`
- [x] Verify settings page shows only Light and Dark options
- [x] Verify switching between Light and Dark works correctly

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note removal of System theme option and rationale
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Users with `"system"` in localStorage get unexpected behavior | Low | Migration code converts `"system"` to `"light"` on load |
| TypeScript build errors from stale `"system"` references elsewhere | Low | Grep for `"system"` theme references across the codebase; fix any remaining |

---

## Definition of done

- [x] Settings page shows only Light and Dark theme options
- [x] No `"system"` references remain in theme-related code
- [x] Existing users with `"system"` preference are migrated to `"light"`
- [x] Theme switching between Light and Dark works correctly
- [x] All quality checks pass (lint, test, build)
