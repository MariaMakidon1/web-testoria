# ADR-001: Vue 3 with Composition API

**Status**: Accepted
**Date**: 2024

---

## Context

We needed a frontend framework for Testoria — a moderately complex SPA with multiple data-heavy list views, shared state across features, rich text editing, chart rendering, and a strict auth/role model.

Candidates evaluated: Vue 3, React 18, Angular 17.

---

## Decision

We chose **Vue 3** with the **Composition API** (`<script setup lang="ts">`). No Options API is used anywhere in this codebase.

---

## Rationale

- **TypeScript integration**: Vue 3 with `<script setup>` has excellent TypeScript inference. Props and emits typed at compile time via `defineProps<{}>` generics.
- **Composition API**: Logic reuse via composables (`useExport`, `useBulkOperations`, etc.) without mixins or higher-order components. Keeps feature logic co-located and testable.
- **Ecosystem**: PrimeVue 4, Vue Router 5, Pinia, vue-chartjs all have first-class Vue 3 support.
- **Bundle size**: Vite + Vue 3's tree-shaking produces smaller bundles than the Vue 2 equivalent.
- **Team familiarity**: Existing team experience with Vue.

React was not chosen due to preference for template-based rendering (more intuitive for non-JS-heavy team members) and Vue's built-in reactivity system being simpler for this use case.

---

## Consequences

- All new components must use `<script setup lang="ts">` — no Options API.
- Reactivity is Vue's `ref`/`reactive` system — not React hooks.
- State management is Pinia (see ADR-002), not Redux or Zustand.
- Testing uses `@vue/test-utils` + Vitest.
