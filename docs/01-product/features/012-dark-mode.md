# Feature: Dark Mode

## What it does

Dark Mode (and theme management generally) provides two theme options — `light` and `dark` — for the application. Users toggle the theme via a button in the application header or pick it from `SettingsView`. The preference is persisted across sessions.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **All roles** | Toggle theme — applies to the current user's browser only |

## Key behaviours

- Toggle button is in `AppHeader.vue`.
- Theme preference is stored in **`stores/preferences`** (key `theme`) and persisted to **`localStorage`** under `testoria_preferences`.
- Two theme values: `'light'` (default on first visit) and `'dark'`.
- `applyTheme()` in `usePreferencesStore` sets the `data-theme` attribute on `document.documentElement` to the current value.
- `loadPreferences` migrates any legacy `'system'` value from existing localStorage entries to `'light'` on load — no `prefers-color-scheme` listener exists anymore.
- `stores/preferences` contains many other user preferences beyond theme: `compactMode`, `sidebarCollapsed`, `defaultPageSize`, `autoAdvance`, `showTimer`, `confirmOnStatusChange`, `defaultResultStatus`, notification settings, and editor settings. All are persisted together under `testoria_preferences` in localStorage.

## Constraints / edge cases

- Theme preference is **user-local** (localStorage) — it does not sync across devices or users.
- Charts (Chart.js) require separate dark-mode colour configurations — chart text, grid lines, and legend colours must be explicitly set based on the current `data-theme` attribute. See `docs/03-engineering/patterns/charts.md`.
- Third-party content rendered inside rich text (e.g. pasted images) will not automatically adapt to the theme.
- If `localStorage` is cleared, `stores/preferences` resets all preferences to defaults (including `theme: 'light'`).
- The `applyTheme()` function is called at store initialisation, so the correct theme is applied before the first Vue render — no flash of wrong theme.

## Related docs

- `src/stores/preferences.ts` — `UserPreferences` interface, `applyTheme()`
- `src/components/common/AppHeader.vue`
- `docs/02-architecture/frontend/state-management.md`
- `docs/03-engineering/patterns/charts.md` — chart colour handling per theme
- `docs/07-references/llm/design-system.txt` — PrimeVue `data-theme` configuration
