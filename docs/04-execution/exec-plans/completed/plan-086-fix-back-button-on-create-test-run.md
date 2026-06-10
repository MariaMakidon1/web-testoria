# Execution Plan: Fix "Back" Button on Create Test Run Form (TES-80)

**Date**: 2026-05-11
**Author**: gabi
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

The back button at the top of `TestRunCreateView` ("/test-runs/create") returns the user to the page they came from: **Back to Project Overview** when launched from a project's detail page, **Back to Test Runs** otherwise. Same approach also pre-fills + locks the project selector when launched from a project, matching the UX already wired into the existing `:disabled="!!route.query.projectId"` guard.

Linear: [TES-80](https://linear.app/testoria/issue/TES-80/back-to-test-runs-button-in-create-test-run-form-has-incorrect) — Bug, Medium.

---

## Context

`TestRunCreateView.vue:225-230` hard-codes the back button to `router.push('/test-runs')` with the label `"Back to Test Runs"`. There are three call sites that open the form:

1. `src/views/projects/ProjectDetailView.vue:47-49` — `goToNewTestRun()` calls `router.push('/test-runs/create')` with **no query params**, even though it has `projectId` in scope. This is the entry path the bug report is about.
2. `src/views/test-runs/TestRunListView.vue:204` and `:297` — both open `/test-runs/create` from the runs list. Back-to-test-runs is correct here.
3. `src/views/dashboard/DashboardView.vue:425`, `:649`, `:689` — open from the dashboard's empty-state CTAs. No project context; back-to-test-runs is acceptable.

The form already has the plumbing for project-context entry: `route.query.projectId` is read at line 32-36 to seed the project ref, and the project Select is disabled when the query param is present (`:disabled="!!route.query.projectId"` at line 260). The Project Overview entry point just isn't using that contract — it relies on `projectsStore.selectedProjectId` (set in `ProjectDetailView.onMounted`) for the prefill, which means the query param is empty and the back button has no signal for where the user came from.

Two-line fix:
- Make the project-overview entry pass `?projectId=<id>` so the form sees the context.
- Make the back button derive its label and destination from `route.query.projectId`.

No backend changes; no test-runs list / dashboard call-site changes.

---

## Scope

### In scope

- `src/views/projects/ProjectDetailView.vue`: `goToNewTestRun()` → `router.push({ path: '/test-runs/create', query: { projectId: String(projectId) } })`. Use the named query form to make the contract explicit and survive a future `path` change.
- `src/views/test-runs/TestRunCreateView.vue`:
  - Add a `backTarget` computed that derives `{ label, to }` from `route.query.projectId`:
    - If present → `{ label: 'Back to Project Overview', to: \`/projects/${route.query.projectId}\` }`
    - Else → `{ label: 'Back to Test Runs', to: '/test-runs' }`
  - Bind the existing back button to `backTarget.label` and `router.push(backTarget.to)`.
  - Keep the existing logic that disables the project selector when `route.query.projectId` is set — no change needed.
- `data-testid="create-back-btn"` on the back button so the e2e + future tests can target it without coupling to label text.
- Playwright e2e in `tests/e2e/test-runs.spec.ts` (or `tests/e2e/test-runs-back-nav.spec.ts`): from `/projects`, click first project → click **New Test Run** → assert back-button label is **Back to Project Overview** and `route.query.projectId` is set → click it → assert URL matches `/projects/\d+$`. Plus a parallel case for the test-runs list entry → label stays **Back to Test Runs**.
- Unit test: a small `TestRunCreateView`-focused test isn't worth the mounting cost (heavy stepper/select/store deps); covered by the e2e.

### Out of scope

- Changing how the dashboard CTAs route into the form. They could pass `projectId` derived from the global selector, but the user's mental model on the dashboard is "go create *a* run", not "go create *a run for the currently-selected project*"; if QA wants that, separate plan.
- Adding a `from` query param more general than `projectId` (e.g., `?from=/some/url`). `projectId` is sufficient for today's bug; a generic `from` opens a redirect-injection surface and demands an allow-list. Out of scope.
- Replacing the back button with `router.back()`. Browser-history back is fragile (deep-link entry has no history; history has the wrong entry after submit redirects). Explicit destinations are clearer and survive refresh.
- Renaming the **Cancel button missing** ([TES-72](https://linear.app/testoria/issue/)) work — distinct issue.
- Backend changes — none.

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| view | `src/views/projects/ProjectDetailView.vue` | `goToNewTestRun` passes `query: { projectId: String(projectId) }` on the push |
| view | `src/views/test-runs/TestRunCreateView.vue` | Add `backTarget` computed (label + to). Bind the back button's `label` and `@click`. Add `data-testid="create-back-btn"` |
| tests | `tests/e2e/test-runs.spec.ts` | Project-overview entry → back label is "Back to Project Overview" + URL returns to `/projects/:id`. Test-runs list entry → label stays "Back to Test Runs" |
| docs | `docs/01-product/features/005-test-run-planning.md` | Note the back-button context-awareness behaviour |

### Key decisions

- **Derive context from `route.query.projectId`, don't add a new `from` param.** The query param is already consumed by the form for prefilling/disabling the Select; reusing it is one signal, not two.
- **Pass `projectId` as a string in the push.** `router.push({ query })` stringifies anyway, but explicit `String(projectId)` keeps the call site self-documenting. The form already coerces back via `Number(route.query.projectId)`.
- **Explicit back destination, not `router.back()`.** History is fragile: a user who deep-links to `/test-runs/create?projectId=5` has no prior history; `router.back()` would land on `about:blank`. An explicit `router.push` to `/projects/:id` works in every case.
- **Computed for the back target, not two separate refs.** Single source of truth for label + destination eliminates the "label says X but destination is Y" class of bug — the very bug we're fixing.
- **No new test-id on the project-overview "New Test Run" button.** It already lives on `ProjectDetailView`; e2e can target it by visible text. Adding a test-id is cheap if QA asks.
- **No e2e cleanup of the created run.** Existing test-run e2e specs don't clean up either; matching convention. Stale e2e data is acceptable for this repo today.

---

## Tasks

### Implementation
- [x] In `src/views/projects/ProjectDetailView.vue`: `goToNewTestRun` → `router.push({ path: '/test-runs/create', query: { projectId: String(projectId) } })`
- [x] In `src/views/test-runs/TestRunCreateView.vue`:
  - [x] Add `backTarget` computed
  - [x] Bind back button `label` and `@click` to it
  - [x] Add `data-testid="create-back-btn"`
- [x] Playwright e2e in `tests/e2e/test-runs.spec.ts`:
  - [x] Project-overview entry → asserts label and back-destination
  - [x] Test-runs list entry → asserts label stays "Back to Test Runs"

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc strict)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/01-product/features/005-test-run-planning.md` — note the back-button is context-aware via `?projectId`
- [x] `docs/08-decisions/changelog.md` — plan-086 entry: context-aware back via `?projectId` query param
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Adding `?projectId=<id>` from ProjectDetailView newly disables the project Select; user can't change it on this entry path | Intentional | This was already the documented behaviour of the `:disabled` binding (line 260). Project-overview entry now correctly opts in. If we later want a "change project" affordance from this entry, that's a separate UX call |
| A user deep-links to `/test-runs/create?projectId=999` where 999 doesn't exist; back button would push to `/projects/999` and 404 | Low | Guard exists in `ProjectDetailView` already (404 lands on the project-not-found view). Acceptable; matches what would happen if any other broken link were followed |
| `router.push({ query: ... })` retains other query params — none here, but if future params are added the back-target derivation might still see old keys | Low | Computed reads only `route.query.projectId`; ignores siblings. Safe |
| Playwright project-overview entry test is brittle if project rows lack a stable selector | Medium | Use `page.locator('tbody tr').first().click()` — same pattern as existing test-runs / projects e2e specs |

---

## Definition of done

- [x] From a project overview, **New Test Run** opens the form with the back button labelled **Back to Project Overview**; clicking it returns to that project's overview page
- [x] From the test runs list, the back button still reads **Back to Test Runs** and returns to `/test-runs`
- [x] From the dashboard CTAs, behaviour unchanged (back to `/test-runs`)
- [x] `npm run lint`, `npm run test -- --run`, `npm run build` all pass
- [x] Playwright e2e covers both entry paths
- [x] Feature doc updated; changelog entry added
- [x] TES-80 marked Done in Linear with the merge commit linked
