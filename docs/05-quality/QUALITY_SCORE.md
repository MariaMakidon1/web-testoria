# Quality Score

Current state of quality metrics and targets for the Testoria frontend.

---

## Current state (as of 2026-06-01)

| Dimension | Status | Notes |
|-----------|--------|-------|
| TypeScript strict mode | Enabled | No `any` policy enforced |
| Unit test coverage | Partial | Stores: auth (incl. password recovery actions — plan-097 — and `canManageUsers` role flag — plan-098), testCases, testRuns, notifications, savedFilters, preferences. Components: ResetPasswordView token paths, UserForm (role-option ceiling + invite-only no-password — plan-098). Composables: useBulkOperations, useExport, useImport. Run `npm run test:coverage` to measure. |
| E2E test coverage | Partial | login, password recovery (navigation + invalid-link states; happy paths `fixme` pending api 048), test run creation, test execution flows. Playwright config in place. |
| Lint passing | Yes | ESLint + eslint-plugin-vue (2 pre-existing warnings in vite-env.d.ts, no errors) |
| Build passing | Yes | vue-tsc + vite |
| Accessibility | Improved | Lighthouse 87 → target ≥ 92. ARIA fix applied to LoginView Password component; color contrast fixed on submit button. |
| Performance | Improved | Lighthouse 65 → target ≥ 75. On-demand chunks (excel, pdf, editor) excluded from modulepreload; esbuild target set to esnext for deps. |
| SEO | Good | Lighthouse 90 → 100 expected. `<meta name="description">` added to index.html. |
| Best Practices | Good | Lighthouse 96 → 100 expected. Favicon 404 fixed — `public/favicon.svg` created. |
| Security audit | CI configured | `npm audit --audit-level=high` runs in CI on every push |
| 404 handling | Done | `NotFoundView.vue` + catch-all route |
| Documentation | Complete | Architecture, LLM refs, engineering docs complete. Feature docs populated — 13 files in `docs/01-product/features/`. |

---

## Targets

| Dimension | Target |
|-----------|--------|
| Unit test coverage | ≥ 70% for stores and composables |
| E2E coverage | All critical user flows: login, test run creation, execution, reports |
| Lighthouse Performance | ≥ 80 |
| Lighthouse Accessibility | ≥ 90 |
| Build warnings | 0 |
| `npm audit` high/critical | 0 |
| Feature docs | One `docs/01-product/features/<name>.md` per shipped feature |

---

## How to measure

```bash
# Unit test coverage
npm run test:coverage
# Opens coverage report in coverage/index.html

# E2E tests
npm run test:e2e

# Lighthouse (requires a running app)
npx lighthouse http://localhost:4173 --output html --output-path lighthouse-report.html

# Dependency audit
npm audit
```

---

## Open quality improvements

1. Expand E2E coverage to reports flow and dark mode toggle
2. Reach ≥ 70% unit test coverage (run `npm run test:coverage` to check gap)
3. Add `data-testid` attributes to key interactive elements for stable E2E selectors
4. Consider SSR/pre-rendering if FCP on simulated mobile remains above 3 s after further Lighthouse runs
