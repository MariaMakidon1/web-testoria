# Testoria Web Frontend

Vue 3 SPA (frontend only). Backend is a separate FastAPI service.
Core hierarchy: **Project → TestSuite → TestCase → TestRun → TestResult**
Stack: Vue 3 · Pinia 3 · Vue Router 5 · PrimeVue 4 · Axios · Vite 6 · Vitest · Playwright

---

## Hard invariants — never break these

1. No component imports from `src/api/` — all data goes through stores
2. All authenticated routes carry `meta: { requiresAuth: true }`
3. Role checks via `stores/auth` flags (`isAdmin`, `isProjectManager`, `canManageTests`) — never `user.role` directly
4. UI-only state (sidebar, modals, dark mode, notifications) lives in `stores/ui` only

Layer flow: `View/Component → Store → api/<domain> → apiClient → backend`

---

## Standard work cycle

Every piece of work — bug fix, improvement, or new feature — follows this five-phase cycle.
The phases and which docs to read/write at each step are defined below.

---

### Phase 1 — Orient (session start)

Always check before doing anything:
1. `docs/04-execution/exec-plans/active/` — any in-progress plans?
2. `docs/04-execution/tech-debt.md` — relevant open items?
3. `docs/00-meta/AGENTS.md` — invariants and orientation

---

### Phase 2 — Plan

**Read before writing the plan:**
1. `docs/01-product/index.md`
2. `docs/01-product/features/<name>.md` — if updating an existing feature
3. `docs/02-architecture/ARCHITECTURE.md`
4. `docs/00-meta/GLOSSARY.md`
5. `docs/04-execution/tech-debt.md`
6. `docs/06-generated/routes-map.md`
7. `docs/06-generated/api-schema.md`
8. Relevant `docs/02-architecture/frontend/*.md` for the area being changed
9. Relevant `docs/03-engineering/patterns/*.md` for the patterns being used
10. `docs/04-execution/exec-plans/templates/plan-template.md`

**Write the plan:**
- Save as `docs/04-execution/exec-plans/active/plan-NNN-description.md`
  - NNN is the next sequential number after the highest existing plan number across both `active/` and `completed/` directories (e.g. if highest is `plan-015-…`, new plan is `plan-016-…`)
  - Always check both directories before picking the number
- Use the template — fill every section, do not skip Definition of Done

---

### Phase 3 — Execute

**Read before writing code:**
1. `docs/07-references/llm/frontend-rules.txt`
2. `docs/07-references/llm/coding-standards.txt`
3. `docs/02-architecture/ARCHITECTURE.md` (invariants)
4. Load only the pattern docs for what is being built:
   - New domain feature → `docs/00-meta/AGENTS.md`
   - Components / views → `docs/03-engineering/patterns/component-patterns.md`
   - Forms → `docs/03-engineering/patterns/forms.md`
   - Composables → `docs/03-engineering/patterns/composables.md`
   - Charts → `docs/03-engineering/patterns/charts.md`
   - UI / PrimeVue → `docs/07-references/llm/design-system.txt`
   - State / stores → `docs/02-architecture/frontend/state-management.md`
   - Routing → `docs/02-architecture/frontend/routing.md`
   - API layer → `docs/02-architecture/frontend/api-layer.md`

**While implementing:**
- Tick off plan task checkboxes as each task completes
- Write tests alongside code — see `docs/03-engineering/testing/`

---

### Phase 4 — Quality check

Before marking the plan complete, verify:
1. `npm run lint` — no errors
2. `npm run test -- --run` — all unit tests pass
3. `npm run build` — type check + production build passes
4. Read `docs/05-quality/checklists/pr-checklist.md` and confirm every item

---

### Phase 5 — Update docs

After all code is working and quality checks pass, update docs in this order:

| What changed | Doc to update |
|---|---|
| New or changed routes | **Read** `docs/06-generated/routes-map.md`, verify every row matches `src/router/index.ts`, add/remove/rename rows as needed |
| New or changed API functions | **Read** `docs/06-generated/api-schema.md`, verify every function, path, and return type matches `src/api/*.ts`, add/remove/correct rows as needed |
| New feature implemented | Create `docs/01-product/features/<feature-name>.md` |
| Existing feature changed | **Read** the existing `docs/01-product/features/<feature-name>.md` top-to-bottom, then update every claim that no longer matches the real implementation — including stale "not yet implemented", "future improvement", wrong types, wrong file paths, and missing behaviours |
| Architectural decision made | Add entry to `docs/08-decisions/changelog.md` |
| New tech debt incurred | Add to `docs/04-execution/tech-debt.md` |
| Tech debt resolved | Move item to Resolved in `docs/04-execution/tech-debt.md` |
| New store, composable, component, or view added | **Read** `docs/02-architecture/ARCHITECTURE.md` and update the Codemap, "Where is the thing that does X?" table, Key types section, and any other section that no longer matches reality |
| Architectural invariant changed | Update the invariants section in `docs/02-architecture/ARCHITECTURE.md` |
| API layer changed (new endpoint, auth) | **Read** `docs/02-architecture/frontend/api-layer.md` and correct any stale descriptions |
| Routing changed (new route, guard logic) | **Read** `docs/02-architecture/frontend/routing.md` and correct any stale descriptions |
| Store structure or pattern changed | **Read** `docs/02-architecture/frontend/state-management.md` and correct any stale descriptions |
| New composable or store added | Update relevant `docs/03-engineering/` doc |
| Quality metrics changed | Update `docs/05-quality/QUALITY_SCORE.md` |

**Finally:** confirm every feature doc touched by this plan accurately describes the current implementation, then move the plan file from `active/` to `docs/04-execution/exec-plans/completed/`

---

### Writing tests only

1. `docs/03-engineering/testing/strategy.md`
2. `docs/03-engineering/testing/unit.md` (unit tests)
3. `docs/03-engineering/testing/e2e.md` (e2e tests)

### Reviewing / merging a PR

Read: `docs/05-quality/checklists/pr-checklist.md`

### Preparing a release

Read: `docs/05-quality/checklists/release-checklist.md`

### Debugging / investigating

Read: `docs/02-architecture/ARCHITECTURE.md` (codemap), then the relevant `src/` files directly.

---

## Dev commands
```bash
npm run dev           # dev server
npm run build         # vue-tsc + vite production build
npm run test          # vitest (unit)
npm run test:e2e      # playwright (e2e)
npm run lint          # eslint --fix
npm run format        # prettier
```

Set `VITE_API_URL` in `.env.local` to point to the backend (default: `/api/v1`).
