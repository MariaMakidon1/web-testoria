# Execution Plan: CI/CD Improvements

**Date**: 2026-03-23
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Split the monolithic `ci-cd.yml` into two focused workflow files and fix security, reliability, and speed issues in the pipeline.

---

## Context

The current `.github/workflows/ci-cd.yml` has several problems discovered during review:

- CI only triggers on `push: main` — PRs are never validated before merge
- A GH_PAT token is embedded directly in a git URL inside an SSH script, risking log leakage
- No Docker layer caching — every push rebuilds all image layers from scratch
- Lighthouse runs in the same job as lint/type-check, slowing fast-feedback loops
- No `concurrency` group on the deploy job — two fast pushes can trigger parallel deploys
- E2E tests (Playwright) exist in the repo but are never run in CI
- No health check after `docker compose up -d` — a failed container start goes undetected

---

## Scope

### In scope
- Split `ci-cd.yml` into `ci.yml` and `cd.yml`
- Add `pull_request` trigger to CI so PRs are validated
- Move Lighthouse into its own parallel job within CI
- Add Playwright e2e tests step to CI
- Add `concurrency` group to the deploy job
- Add Docker build layer caching via GHCR cache
- Fix GH_PAT leak: replace token-in-URL with a safe credential helper approach
- Add post-deploy health check step

### Out of scope
- Semantic versioning / release tagging (deferred)
- Staging / preview environment deploys (deferred)
- Automated rollback on failed deploy (deferred)
- Migrating from EC2 to a managed container platform (separate decision)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| CI workflow | `.github/workflows/ci.yml` | New file — lint, type-check, unit tests, e2e, lighthouse (parallel jobs) |
| CD workflow | `.github/workflows/cd.yml` | New file — build & push Docker, deploy to EC2 |
| Old workflow | `.github/workflows/ci-cd.yml` | Deleted |

### Workflow structure after change

**`ci.yml`** — triggers: `push: main`, `pull_request`

```
check (lint + type-check + unit tests)
  └── e2e          [needs: check]
  └── lighthouse   [needs: check, parallel with e2e]
```

**`cd.yml`** — triggers: `push: main` only, `workflow_run: ci / completed`

```
build-and-push   [needs: ci to have passed]
  └── deploy     [needs: build-and-push]
```

### Key decisions

- **Two files over one**: CI runs on PRs, CD never should. Keeping them separate avoids `if:` guards proliferating across every step and makes the intent obvious.
- **`workflow_run` to link CI → CD**: CD listens for the `ci` workflow to complete with `conclusion == success` on `main`, rather than duplicating the `needs: ci` pattern across files.
- **GHCR cache for Docker**: Use `cache-from: type=registry` + `cache-to: type=registry,mode=max` on the GHCR image. No extra infrastructure needed.
- **GH_PAT fix**: Replace the token-in-URL with a `git config --global url.insteadOf` + `extraheader` pattern, or use a deploy key. Credential is never part of the URL printed in logs.
- **Concurrency on deploy**: `cancel-in-progress: false` — never cancel an in-flight deploy, but queue the next one so it runs after.
- **Health check**: After `docker compose up -d`, poll `curl --fail --retry 5 --retry-delay 3 http://localhost/health` (or equivalent) to confirm the container responds before the job exits green.

---

## Tasks

### Implementation
- [ ] Create `.github/workflows/ci.yml` with jobs: `check`, `e2e`, `lighthouse`
- [ ] Create `.github/workflows/cd.yml` with jobs: `build-and-push`, `deploy`
- [ ] Add `concurrency` group to `deploy` job in `cd.yml`
- [ ] Add Docker layer caching (`cache-from` / `cache-to`) to `build-and-push`
- [ ] Fix GH_PAT usage in deploy SSH script (remove token from URL)
- [ ] Add post-deploy health check step to `deploy` job
- [ ] Delete `.github/workflows/ci-cd.yml`

### Quality check (Phase 4)
- [ ] Trigger a PR to verify `ci.yml` runs and reports status on the PR
- [ ] Merge to `main` to verify `cd.yml` triggers after CI passes
- [ ] Confirm Docker cache hit on a second push (check build logs)
- [ ] Confirm deploy job is queued (not duplicated) when two pushes land quickly
- [ ] Confirm health check step passes on a good deploy

### Docs update (Phase 5)
- [ ] `docs/04-execution/tech-debt.md` — no new debt; mark any relevant resolved items
- [ ] `docs/08-decisions/changelog.md` — record the CI/CD split decision
- [ ] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `workflow_run` link between `ci.yml` and `cd.yml` has a known quirk: it only fires when the triggering workflow is on the default branch | Low | Document this; `push: main` already ensures CD only runs on main |
| GH_PAT refactor breaks the repo clone step on EC2 | Medium | Test the new credential approach on a branch deploy before deleting the old workflow |
| Playwright e2e in CI requires a running dev server — cold start may time out | Low | Use `npx serve dist` against the mock build (same approach as Lighthouse CI already uses) |

---

## Definition of done

- [ ] `ci.yml` runs on every PR and reports pass/fail on the PR checks UI
- [ ] `cd.yml` only runs after CI passes on `main`
- [ ] No GH_PAT token appears in any workflow log URL
- [ ] Docker build logs show a cache hit on the second push
- [ ] Deploy job queues rather than runs in parallel on concurrent pushes
- [ ] Post-deploy health check is visible as a passing step in CD logs
- [ ] Old `ci-cd.yml` is deleted
- [ ] Docs updated
