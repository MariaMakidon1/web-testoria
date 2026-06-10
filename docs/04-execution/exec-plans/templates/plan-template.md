# Execution Plan: [Feature Name]

**Date**: YYYY-MM-DD
**Author**:
**Status**: Draft | In Progress | Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

One sentence: what does this plan deliver?

---

## Context

Why is this being built? What problem does it solve? Link to any relevant issues or decisions.

---

## Scope

### In scope
- Item 1
- Item 2

### Out of scope
- Item A (deferred to later)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/<domain>.ts` | New interfaces |
| api | `src/api/<domain>.ts` | New functions |
| store | `src/stores/<domain>.ts` | New actions/state |
| views | `src/views/<domain>/` | New/updated views |
| components | `src/components/<domain>/` | New/updated components |
| router | `src/router/index.ts` | New routes |

### Key decisions

- Decision 1 and rationale
- Decision 2 and rationale

---

## Tasks

### Implementation
- [ ] Define types in `src/types/<domain>.ts`
- [ ] Add API functions in `src/api/<domain>.ts`
- [ ] Add/update store
- [ ] Build view(s)
- [ ] Build component(s)
- [ ] Add routes with `requiresAuth: true`
- [ ] Write unit tests
- [ ] Write e2e tests (critical flows)

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/routes-map.md` updated (if routes changed)
- [ ] `docs/06-generated/api-schema.md` updated (if API changed)
- [ ] `docs/01-product/features/<feature-name>.md` created or updated
- [ ] `docs/08-decisions/changelog.md` updated (if architectural decision made)
- [ ] `docs/04-execution/tech-debt.md` updated (if debt added or resolved)
- [ ] `docs/05-quality/QUALITY_SCORE.md` updated (if quality metrics changed)
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| | | |

---

## Definition of done

- [ ] Feature works end-to-end against real backend
- [ ] Unit tests written and passing
- [ ] PR checklist completed
- [ ] Docs updated
