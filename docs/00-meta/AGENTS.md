# AGENTS — How to work in this repo

Instructions for LLM agents (Claude, Copilot, etc.) operating in the Testoria web frontend codebase.

---

## Read these first

Before doing anything, load and internalize:

1. `docs/02-architecture/ARCHITECTURE.md` — single source of truth for structure and invariants
2. `docs/07-references/llm/frontend-rules.txt` — hard rules for code generation
3. `docs/07-references/llm/coding-standards.txt` — TypeScript/Vue standards
4. `docs/07-references/llm/design-system.txt` — PrimeVue component patterns

---

## Orientation: "where is X?"

| Question | Where to look |
|----------|--------------|
| What does this app do? | `docs/01-product/index.md` |
| Where is the code for feature X? | `ARCHITECTURE.md` → Codemap and "Where is the thing that does X?" table |
| What routes exist? | `docs/06-generated/routes-map.md` or `src/router/index.ts` |
| What API endpoints exist? | `docs/06-generated/api-schema.md` or `src/api/<domain>.ts` |
| What TypeScript types exist? | `src/types/<domain>.ts` |
| What UI components are available? | `docs/07-references/llm/design-system.txt` + `src/components/common/index.ts` |
| What patterns to follow? | `docs/03-engineering/patterns/` |
| Known tech debt? | `docs/04-execution/tech-debt.md` |

---

## How to navigate the codebase

The directory structure follows a strict domain layering:

```
src/
  api/          → HTTP functions, one file per domain
  stores/       → Pinia stores (shared state)
  types/        → TypeScript types (no runtime imports)
  composables/  → Reusable logic
  router/       → Routes + auth guard
  views/        → One component per route (thin)
  components/   → common/ + <domain>/
  layouts/      → DefaultLayout wraps all auth views
```

Start from `src/router/index.ts` to understand what views exist, then follow from view → store → api.

---

## Work cycle

All work follows a five-phase cycle defined in `CLAUDE.md`. Short version:

1. **Orient** — check `docs/04-execution/exec-plans/active/` and `docs/04-execution/tech-debt.md`
2. **Plan** — read relevant docs, create plan in `docs/04-execution/exec-plans/active/` using the naming convention `plan-NNN-description.md` where NNN is the next sequential number after the highest existing plan in both `active/` and `completed/`
3. **Execute** — implement code, tick plan checkboxes as tasks complete
4. **Quality check** — lint + tests + build + `docs/05-quality/checklists/pr-checklist.md`
5. **Update docs** — routes-map, api-schema, feature doc, changelog, tech-debt, quality score; move plan to `completed/`

## Making changes

### Adding a new feature

1. Create execution plan in `docs/04-execution/exec-plans/active/plan-NNN-description.md` (NNN = next sequential number after highest in `active/` + `completed/`)
2. Define types in `src/types/<domain>.ts`
3. Add API functions in `src/api/<domain>.ts`
4. Add/update store in `src/stores/<domain>.ts`
6. Add/update view in `src/views/<domain>/<Name>View.vue`
7. Add/update components in `src/components/<domain>/`
8. Add route to `src/router/index.ts` with `meta: { requiresAuth: true }`
9. Write unit + e2e tests
10. Create `docs/01-product/features/<domain>.md`
11. Update `docs/06-generated/routes-map.md` and `api-schema.md`
12. Move plan to `docs/04-execution/exec-plans/completed/`

### Modifying existing behavior

- Read the existing file before changing it
- Check `ARCHITECTURE.md` invariants — do not violate them
- Update `docs/01-product/features/<domain>.md` to reflect the change

### Adding a new domain (e.g., milestones)

Create: `src/types/milestone.ts`, `src/api/milestones.ts`, `src/stores/milestones.ts`. Follow the existing domain files as templates.

---

## What NOT to do

- Do not write to `localStorage` directly outside `api/client.ts` and `stores/auth.ts`
- Do not call `apiClient` from a component or composable
- Do not read `user.role` in a component — use the auth store flags
- Do not add an authenticated route without `meta: { requiresAuth: true }`
- Do not create a new UI component if an existing PrimeVue or common/ component fits
- Do not add a new dependency without a clear reason — check if an existing library covers it

---

## Running the app

```bash
npm install
npm run dev          # dev server
npm run test         # unit tests (vitest)
npm run test:e2e     # e2e tests (playwright)
npm run build        # production build (vue-tsc + vite)
npm run lint         # eslint fix
npm run format       # prettier
```

All API calls go to the real backend at `VITE_API_URL` (default: `/api/v1`).

---

## Key invariants (never break these)

1. No component imports from `src/api/`
2. No store imports another store's internal state directly
3. All authenticated routes carry `meta: { requiresAuth: true }`
5. Role checks via `stores/auth` flags, never via `user.role` in components
6. `stores/ui` is the only home for UI-only state (sidebar, modals, notifications)
