# CONTRIBUTING — Testoria Web Frontend

---

## Prerequisites

- Node.js >= 24.13.0 (see `engines` in `package.json`)
- npm >= 10

---

## Setup

```bash
git clone <repo>
cd web-testoria
npm install
npm run dev        # starts Vite dev server (default: http://localhost:5173)
```

A running backend is required. Set `VITE_API_URL` in `.env.local` if not using the default.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api/v1` | Backend API base URL |

Create a `.env.local` file to override:

```
VITE_API_URL=http://localhost:8000/api/v1
```

---

## Branching

- `main` — production-ready, protected. All merges via PR.
- Feature branches: `feature/<short-description>`
- Bug fixes: `fix/<short-description>`
- Hotfixes: `hotfix/<short-description>`

---

## Development workflow

1. Branch off `main`
2. Make changes following the rules in `docs/07-references/llm/frontend-rules.txt`
3. Run `npm run lint` and `npm run format`
4. Run `npm run test` — all tests must pass
5. Open a PR against `main`
6. PR checklist: `docs/05-quality/checklists/pr-checklist.md`

---

## Adding new code

### New domain feature
Follow the sequence: `types/` → `api/` → `stores/` → `views/` → `components/`. See `docs/00-meta/AGENTS.md` for the full checklist.

### New component
Place in `src/components/common/` if generic, `src/components/<domain>/` if feature-specific. Register in `src/components/common/index.ts` if it should be globally available.

### New route
Add to `src/router/index.ts` with `meta: { requiresAuth: true }`. Add lazy import. Update `docs/06-generated/routes-map.md`.

### New API endpoint
1. Add function to `src/api/<domain>.ts`
2. Update `docs/06-generated/api-schema.md`

---

## Testing

```bash
npm run test              # unit tests (vitest, watch mode)
npm run test:coverage     # coverage report
npm run test:e2e          # playwright e2e
```

Unit tests live alongside source files as `*.spec.ts` or in a `__tests__/` folder. E2E tests live in `tests/e2e/` (or `e2e/`).

---

## Code style

- Prettier + ESLint enforced. Run `npm run lint` before committing.
- Commit messages: conventional commits format (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- No console.log in committed code.

---

## CI/CD

GitHub Actions runs on every PR:
- Lint
- Type check (`vue-tsc`)
- Unit tests

Production deploy (`workflow_dispatch`): CI builds the static `dist/` bundle, ships it to the EC2 host, and host nginx serves it from `/var/www/testoria/current` (the SPA is no longer containerized). See `.github/workflows/pipeline.yml`, `deploy/web.vhost.conf`, and the host runbook in `api-testoria/deploy/README.md`.
