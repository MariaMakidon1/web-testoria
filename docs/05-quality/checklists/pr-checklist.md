# PR Checklist

Review this before opening or merging a pull request.

---

## Code quality

- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` passes (vue-tsc type check + vite build)
- [ ] `npm run test` passes — all unit tests green
- [ ] No `console.log` statements in committed code
- [ ] No `any` types introduced
- [ ] No hardcoded API URLs or magic strings

## Architecture

- [ ] No component imports directly from `src/api/` (all data goes through stores)
- [ ] No new authenticated route without `meta: { requiresAuth: true }`
- [ ] Role checks use `stores/auth` flags (`isAdmin`, `canManageTests`), not `user.role` directly
- [ ] UI-only state (modals, loading indicators) goes into `stores/ui`, not feature stores
- [ ] New types added to `src/types/` — no type definitions inside components or stores

## Vue / TypeScript

- [ ] `<script setup lang="ts">` — no Options API
- [ ] Props and emits use TypeScript generics (`defineProps<{}>`, `defineEmits<{}>`)
- [ ] `storeToRefs()` used when destructuring store state in components
- [ ] `v-for` has `:key` on every loop
- [ ] No `v-if` and `v-for` on the same element
- [ ] No logic heavier than a ternary in template expressions

## UX

- [ ] Loading states shown during async operations (store `loading` ref bound to component)
- [ ] Empty states handled (use `<EmptyState>` component)
- [ ] Error states shown (store `error` ref displayed to user)
- [ ] Destructive actions require confirmation (`<ConfirmDialog>`, not `window.confirm`)
- [ ] Interactive elements are keyboard-accessible (proper `tabindex`, ARIA labels)
- [ ] New icons use PrimeIcons (`pi pi-*`), not inline SVGs or other libraries

## Documentation

- [ ] If new routes added: `docs/06-generated/routes-map.md` updated
- [ ] If new API functions added: `docs/06-generated/api-schema.md` updated
- [ ] If new feature implemented: `docs/01-product/features/<name>.md` created
- [ ] If existing feature changed: `docs/01-product/features/<name>.md` updated
- [ ] If architectural decision made: `docs/08-decisions/changelog.md` entry added
- [ ] If new composable or store added: relevant `docs/03-engineering/` doc updated
- [ ] If quality metrics changed: `docs/05-quality/QUALITY_SCORE.md` updated
- [ ] If tech debt resolved: moved to Resolved in `docs/04-execution/tech-debt.md`
- [ ] Execution plan moved from `active/` to `docs/04-execution/exec-plans/completed/`
