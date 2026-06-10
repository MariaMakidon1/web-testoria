# Execution Plan: Unified CI/CD Pipeline with Manual Approval Gate

**Date**: 2026-03-24
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Merge `ci.yml` and `cd.yml` into a single `pipeline.yml` and gate the CD phase behind an explicit manual approval step so no deployment reaches production without human sign-off.

---

## Context

Plan-014 split the old monolithic `ci-cd.yml` into two separate workflow files (`ci.yml` and `cd.yml`) linked via a `workflow_run` trigger. That solved the PR-validation problem but introduced two issues that this plan addresses:

1. **Two files, cross-file trigger complexity** — `workflow_run` only fires when the source workflow runs on the default branch and has known edge-case quirks. A single file with conditional jobs is simpler and easier to reason about.
2. **No explicit manual approval** — The `deploy` job already carries `environment: production`, which *can* act as a gate if required reviewers are configured in GitHub settings, but there is no visible approval step in the YAML or the GitHub Actions UI between the CI pass and the Docker build. The intent ("a human must approve this deploy") is not legible from the workflow file alone.

---

## Scope

### In scope
- Merge `ci.yml` and `cd.yml` into `.github/workflows/pipeline.yml`
- Add an explicit `approve` job between the last CI job and the first CD job
- `approve` uses a dedicated GitHub environment (`production-gate`) that must be configured with required reviewers in repo settings
- CD jobs (`build-and-push`, `deploy`) conditioned on `github.ref == 'refs/heads/main'` so PRs only run CI
- Delete `ci.yml` and `cd.yml`

### Out of scope
- Changing any existing CI job logic (check, e2e, lighthouse)
- Changing any existing CD job logic (build-and-push, deploy)
- Automated rollback on failed deploy (deferred from plan-014)
- Staging / preview environments (deferred from plan-014)

---

## Technical approach

### Workflow structure after change

**`pipeline.yml`** — triggers: `push: main`, `pull_request`, `workflow_dispatch`

```
check (lint + type-check + unit tests)
  ├── e2e          [needs: check]
  └── lighthouse   [needs: check]
       ↓
     approve       [needs: e2e, lighthouse; if: main; environment: production-gate]
       ↓
  build-and-push   [needs: approve; if: main]
       ↓
     deploy        [needs: build-and-push; if: main; environment: production]
```

- **PR runs**: `check` → `e2e` + `lighthouse` — approval and CD jobs are skipped entirely (`if: github.ref == 'refs/heads/main'`)
- **Push to main**: full pipeline runs; execution pauses at `approve` until a required reviewer approves in the GitHub Actions UI
- **`workflow_dispatch`**: runs the full pipeline (useful for re-deploying without a code push); approval gate still applies

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| Pipeline | `.github/workflows/pipeline.yml` | New file — all jobs from ci.yml + cd.yml + new approve job |
| Old CI | `.github/workflows/ci.yml` | Deleted |
| Old CD | `.github/workflows/cd.yml` | Deleted |
| GitHub settings | repo → Environments | New `production-gate` environment with required reviewers must be created manually |

### Key decisions

- **Single file over two**: Removes the `workflow_run` cross-file dependency. All job ordering is expressed with `needs:` within one file, which is the standard GitHub Actions pattern for linear pipelines.
- **Dedicated `production-gate` environment for approval**: Keeps the approval step separate from the `production` environment used by the deploy job. This means the GitHub Actions UI shows two distinct environment checkpoints: approval at `production-gate`, then actual deployment at `production`. It also allows different reviewer sets for each if needed in the future.
- **`if: github.ref == 'refs/heads/main'` on CD jobs**: The cleanest way to skip CD on PRs. An alternative is separate triggers per job, but the `if:` condition is more explicit and avoids duplicating the job definitions.
- **`approve` job is a no-op runner job**: The job body is just `run: echo "Approved for deployment"`. All the blocking logic is handled by the GitHub environment's required-reviewer protection rule — no third-party action needed.
- **Retain `concurrency: deploy-production` on `deploy`**: Prevents parallel deploys if two approvals happen in quick succession.

---

## Tasks

### Pre-implementation (repo settings — manual step)
- [ ] Create a `production-gate` environment in GitHub repo settings (Settings → Environments → New environment)
- [ ] Add at least one required reviewer to `production-gate`
- [ ] Optionally set a deployment branch rule: `main` only

### Implementation
- [ ] Create `.github/workflows/pipeline.yml` with all jobs from `ci.yml` and `cd.yml` plus the new `approve` job
- [ ] Add `if: github.ref == 'refs/heads/main'` to `approve`, `build-and-push`, and `deploy` jobs
- [ ] Set `environment: production-gate` on the `approve` job
- [ ] Wire `needs:` so the order is: `check` → `e2e` + `lighthouse` → `approve` → `build-and-push` → `deploy`
- [ ] Delete `.github/workflows/ci.yml`
- [ ] Delete `.github/workflows/cd.yml`

### Quality check (Phase 4)
- [ ] Open a PR — only `check`, `e2e`, `lighthouse` jobs appear; no approval or CD jobs run
- [ ] Merge to main — pipeline pauses at `approve`; CD does not proceed until a reviewer approves in the GitHub Actions UI
- [ ] Approve the deployment — `build-and-push` and `deploy` run to completion
- [ ] Confirm post-deploy health check passes

### Docs update (Phase 5)
- [ ] `docs/08-decisions/changelog.md` — record the unified pipeline + approval gate decision
- [ ] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `production-gate` environment not created before pipeline is merged — `approve` job fails immediately with "environment not found" | Medium | Create the environment first (pre-implementation task); document this as a required setup step |
| `workflow_dispatch` on a non-main branch triggers the approval + CD jobs because `workflow_dispatch` sets `github.ref` to the dispatched branch | Low | The `if: github.ref == 'refs/heads/main'` condition blocks CD; only dispatch from main will proceed past CI |
| Deleting `ci.yml` and `cd.yml` while a `workflow_run`-triggered CD run is in flight | Very low | Merge during a quiet period; the in-flight run uses the old file from its triggering commit and will complete normally |

---

## Definition of done

- [ ] Single `pipeline.yml` file replaces both `ci.yml` and `cd.yml`
- [ ] PR runs show only CI jobs (no approval, no CD)
- [ ] Push to main pauses at `approve` in the GitHub Actions UI and waits for a required reviewer
- [ ] After approval, Docker image is built and pushed, deploy to EC2 completes, health check passes
- [ ] Old `ci.yml` and `cd.yml` are deleted
- [ ] Docs updated
