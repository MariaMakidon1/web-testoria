# ADR-002: Pinia for State Management

**Status**: Accepted
**Date**: 2024

---

## Context

With Vue 3 chosen (ADR-001), we needed a state management solution for shared data (auth, test cases, test runs, UI state). Vuex 4 is the prior generation Vue state library; Pinia is the officially recommended successor.

---

## Decision

We chose **Pinia 3** using the **composition API style** (`defineStore('name', () => { ... })`). No options-style store definitions.

---

## Rationale

- **Official Vue recommendation**: Pinia is the officially recommended state manager for Vue 3.
- **TypeScript**: Composition-style stores have full type inference — getters (computed), actions (functions), and state (refs) are all typed without extra boilerplate.
- **No mutations**: Unlike Vuex, Pinia has no mutation/action split — actions are just async functions.
- **DevTools**: Vue DevTools has built-in Pinia support.
- **Modular**: One store per domain — easier to understand and test in isolation.
- **Composition API alignment**: Stores look and behave like composables, reducing the conceptual gap.

---

## Store conventions (enforced)

1. One store per domain: `src/stores/<domain>.ts`
2. Composition API style only: `defineStore('name', () => { ... })`
3. State as `ref`/`reactive` at top of setup function
4. Derived values as `computed`
5. Actions as plain async functions
6. Every store returns an explicit object listing all exported refs, computeds, and functions
7. UI-only state (`sidebarVisible`, `notifications`, `darkMode`) lives in `stores/ui` — never in feature stores

---

## Consequences

- `stores/auth` is the single source of truth for auth state and role flags.
- Views and components read state via store — never directly from `api/` or `localStorage`.
- Cross-store reads use the composable-store pattern (call `useOtherStore()` inside a store action if needed, not at store definition time to avoid circular dependency issues).
- Pinia's `storeToRefs()` can be used in components to destructure reactive state without losing reactivity.
