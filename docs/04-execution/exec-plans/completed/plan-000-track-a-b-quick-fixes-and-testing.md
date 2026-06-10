# Execution Plan: Track A + B — Quick Fixes & Testing Baseline

**Date**: 2026-03-23
**Author**: Claude
**Status**: Complete

---

## Goal

Resolve all 7 active tech-debt items and establish a testing baseline (unit + e2e + CI quality gates).

---

## Context

The frontend was architecturally sound but had zero tests, 7 known tech-debt items, and two quality-related CI gaps. This plan addresses all of them before new domain features (User Management, Milestones) are layered on top. Source: `docs/04-execution/tech-debt.md`.

---

## Scope

### In scope
- A1: Add 404 catch-all route
- A2: Fix concurrent 401 refresh deduplication in `api/client.ts`
- A3: Debounce filter inputs in `FilterPanel.vue`
- A4: Add `npm audit --audit-level=high` to CI
- B1: Unit tests for `auth`, `testCases`, `testRuns` stores
- B2: Unit tests for `useImport` composable
- B3: Playwright e2e tests for login, test run creation, test execution
- B4: Lighthouse CI with minimum score thresholds

### Out of scope
- HttpOnly cookie migration (requires backend; documented trade-off in `docs/05-quality/SECURITY.md`)
- Mock layer contract tests (deferred — see remaining active item in tech-debt.md)
- New domain features (Track C: User Management, Track D: Milestones)

---

## Technical approach

### Changes required

| Layer | File(s) | What changed |
|-------|---------|--------------|
| router | `src/router/index.ts` | Added `/:pathMatch(.*)*` catch-all → `NotFoundView` |
| views | `src/views/NotFoundView.vue` | New — 404 page with "Go to Dashboard" button |
| api | `src/api/client.ts` | Replaced per-request `_retry` flag with module-level `refreshPromise` for 401 deduplication |
| components | `src/components/common/FilterPanel.vue` | Debounced `emit('filter')` 300ms via `lodash-es/debounce`; model updates remain immediate |
| ci | `.github/workflows/ci-cd.yml` | Added `npm audit --audit-level=high` after `npm ci`; added Lighthouse CI step |
| ci | `.lighthouserc.json` | New — Lighthouse thresholds: accessibility ≥ 0.90 (error), performance ≥ 0.70 (warn), best-practices ≥ 0.90 (warn) |
| tests | `tests/unit/stores/auth.spec.ts` | Expanded: login, logout, role flags, fetchCurrentUser |
| tests | `tests/unit/stores/testCases.spec.ts` | New — fetch, create, update, delete, filters, cache fallback |
| tests | `tests/unit/stores/testRuns.spec.ts` | New — same + closeTestRun, updateTestRunProgress |
| tests | `tests/unit/composables/useImport.spec.ts` | New — JSON + CSV parsing, required fields, validate/transform, edge cases |
| tests | `playwright.config.ts` | New — Playwright config (preview server, Chromium, CI retries) |
| tests | `tests/e2e/pages/LoginPage.ts` | New — Page Object for login |
| tests | `tests/e2e/login.spec.ts` | New — login, logout, redirect, 404 |
| tests | `tests/e2e/test-runs.spec.ts` | New — test run creation flow |
| tests | `tests/e2e/test-execution.spec.ts` | New — execution view, recording results |
| docs | `docs/06-generated/routes-map.md` | Added NotFound route entry |
| docs | `docs/04-execution/tech-debt.md` | Moved 7 resolved items to Resolved section |

### Key decisions

- **Debounce in `FilterPanel` not in stores**: the filter event fires from `FilterPanel.vue` and flows up to views; debouncing at the source means all current and future consumers benefit without per-view changes.
- **`refreshPromise` reset in `.finally()`**: ensures the lock is cleared whether the refresh succeeds or fails, preventing a stuck state if the refresh endpoint returns an error.
- **Lighthouse runs against `dist/` not dev server**: `staticDistDir` in `.lighthouserc.json` avoids the overhead of serving a dev build in CI and tests production output fidelity.
- **E2E tests use id/class selectors**: no `data-testid` attributes existed; used `#username`, `#password`, `button[type="submit"]`, `.p-toast-message-error`. Adding `data-testid` is tracked as a follow-up to make selectors more stable.

---

## Tasks

- [x] Create `NotFoundView.vue`
- [x] Add catch-all route to `src/router/index.ts`
- [x] Fix concurrent 401 refresh in `src/api/client.ts`
- [x] Debounce `filter` emit in `FilterPanel.vue`
- [x] Add `npm audit` step to CI
- [x] Expand `tests/unit/stores/auth.spec.ts`
- [x] Add `tests/unit/stores/testCases.spec.ts`
- [x] Add `tests/unit/stores/testRuns.spec.ts`
- [x] Add `tests/unit/composables/useImport.spec.ts`
- [x] Add `playwright.config.ts`
- [x] Add `tests/e2e/login.spec.ts`
- [x] Add `tests/e2e/test-runs.spec.ts`
- [x] Add `tests/e2e/test-execution.spec.ts`
- [x] Add Lighthouse CI step + `.lighthouserc.json`
- [x] Update `docs/06-generated/routes-map.md`
- [x] Update `docs/04-execution/tech-debt.md`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| E2E tests use class/id selectors that may change | Medium | Add `data-testid` attributes as a follow-up; tests are isolated so breakage is contained |
| Lighthouse CI score below threshold on first run | Medium | Performance threshold set to 0.70 (warn, not error); tighten after first passing run |
| `npm audit` fails on existing transitive vulnerabilities | Low | Check `npm audit` locally first; pin or exclude known false-positives if needed |

---

## Definition of done

- [x] Unknown URLs show NotFoundView
- [x] Single refresh call issued for N concurrent 401s
- [x] Filter inputs debounced at 300ms
- [x] CI fails on high-severity `npm audit` findings
- [x] `npm run test -- --run` passes with store + composable unit tests
- [x] E2E test files cover login, run creation, execution flows
- [x] Lighthouse CI step configured with minimum score thresholds
- [x] `docs/06-generated/routes-map.md` updated
- [x] Tech-debt resolved items documented
