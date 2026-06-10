# Execution Plan: Redirect project-scoped pages when the header project switcher changes

**Date**: 2026-04-20
**Author**:
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

When the user picks a different project from the header project switcher, navigate away from any page whose URL references a record from the old project and land on a safe, project-scoped equivalent:

- Any page under `/test-runs/*` (list, create, detail, execute) → `/test-runs`
- Any `/test-cases/:id` or `/test-cases/:id/edit` detail/edit page → `/projects/:newProjectId/test-cases`

Other pages keep their route (the switcher is a no-op for the URL).

---

## Context

The header switcher calls `projectsStore.setSelectedProject(projectId)` (`src/stores/projects.ts:41`). The selected id is persisted to localStorage and read by list-style pages (dashboard, `/test-cases` index, reports) to filter by project. Those pages auto-refresh their data from the watcher on `selectedProjectId` — no route change is needed.

But several routes embed a record id in the path:

- `/test-runs/:id` (`TestRunDetailView`) — the run belongs to one project
- `/test-runs/:id/execute` (`TestRunExecutionView`)
- `/test-runs/create` — draft state is tied to the previously-selected project
- `/test-cases/:id` (`TestCaseDetailView`) — case belongs to one project
- `/test-cases/:id/edit` (`TestCaseEditorView`)
- `/projects/:projectId/test-cases` (`TestCaseListView`) — project is in the URL

Today, switching the project on any of these leaves the user on the same URL, which is misleading:
- The header shows "Project B" but the page still renders a run/case from "Project A".
- Data fetchers either keep showing the old record (because the route-param id hasn't changed) or error out when permissions differ.

The fix: install one watcher that reacts to `selectedProjectId` changes, inspects the current route, and navigates to the correct fallback. Keep the redirect rule in one place so new project-scoped routes are easy to add.

A related inconsistency: `/projects/:projectId/test-cases` has the project id in the URL while `/test-cases/:id` does not. That mismatch is tech debt, not in scope here; the redirect rule handles both by sending the user to `/projects/:newProjectId/test-cases` when they're on a project-scoped or case-detail page.

---

## Scope

### In scope
- A single watcher on `projectsStore.selectedProjectId` (installed once at the app level — `App.vue` or a composable mounted by `DefaultLayout.vue`)
- Redirect rules driven by the current route name/path:
  - `test-runs-detail`, `test-runs-execute`, `test-runs-create` → `/test-runs`
  - `test-cases-detail`, `test-cases-edit` → `/projects/:newProjectId/test-cases`
  - `projects-test-cases` (i.e. `/projects/:projectId/test-cases`) → `/projects/:newProjectId/test-cases` (swap the id segment)
- Ignore routes where the project is not part of the identity:
  - `/dashboard`, `/test-cases` (index), `/test-runs` (index), `/reports`, `/projects`, `/settings`, auth pages — no redirect
- Trigger only on *user-driven* switch (actual value change), not on initial load / hydration from localStorage — avoid redirect loops on refresh
- Add route `name` values where they are missing (the redirect map uses names, not path parsing) — tech-debt bonus: names are a prerequisite and nothing else in the codebase depends on specific existing names
- Unit test for the redirect mapping logic (pure function given `(currentRoute, newProjectId) -> target | null`)
- E2E: start on `/test-runs/5`, switch project, land on `/test-runs`; start on `/test-cases/12`, switch project, land on `/projects/:new/test-cases`
- Persist the previously-selected project through the redirect step — the switcher call already updates `selectedProjectId` before the redirect fires; the redirect only reads the *new* value from the argument

### Out of scope
- Harmonising `/test-cases/:id` to be project-scoped (`/projects/:pid/test-cases/:id`) — tech debt, separate plan
- "Restore where you were" cross-project memory (e.g., remembering which run you were on in Project A when you come back from Project B) — explicitly not done; user lands on the list
- Switching inside an in-flight edit form without warning — existing unsaved-changes guards (if any) still run; the redirect respects `beforeRouteLeave` hooks; if a form blocks navigation, we keep the user on the page and the switcher reverts (see Key decisions)
- Header switcher UI / label changes
- Store-level data invalidation (currentRun, currentTestCase, etc.) — the route change already unmounts the view; any cross-view leakage is an independent bug
- Deep links from email / external sources with a stale project — user sees the page from the record's project; the switcher is only about in-app interaction

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| router | `src/router/index.ts` | Add `name` to each affected route if missing: `test-runs-list`, `test-runs-create`, `test-runs-detail`, `test-runs-execute`, `test-cases-index`, `test-cases-detail`, `test-cases-edit`, `projects-test-cases` |
| composable | `src/composables/useProjectSwitchRedirect.ts` (new) | One-time watcher: subscribes to `selectedProjectId`, computes the target route from the current route, calls `router.replace(target)` when the target is non-null and differs from the current route |
| mapping | `src/composables/useProjectSwitchRedirect.ts` | Pure function `redirectTargetForSwitch(route, newProjectId) -> RouteLocationRaw \| null`: returns `/test-runs` for any `test-runs-*`, `/projects/:newProjectId/test-cases` for `test-cases-detail`, `test-cases-edit`, or `projects-test-cases`, `null` otherwise |
| init | `src/App.vue` (or `DefaultLayout.vue`) | Call `useProjectSwitchRedirect()` once at setup, after Pinia and router are available |
| store | `src/stores/projects.ts` | No behavior change — `setSelectedProject` already persists; watcher observes the ref |
| tests | `tests/unit/composables/useProjectSwitchRedirect.spec.ts` | Cover every route group: redirects, non-redirects, null/same-id guard, initial-load guard |
| e2e | `tests/e2e/project-switch-redirect.spec.ts` | Full browser flow against the dev server |

### Key decisions

- **Watcher, not router guard**. A route-level `beforeEach` guard runs on route changes, not on store changes. The trigger here is a store mutation. A single Pinia `watch` on `selectedProjectId` is the natural fit, keeps the rule in one place, and avoids per-route guard duplication.
- **Install the watcher in `App.vue` (or `DefaultLayout.vue`)**. The redirect only matters inside the authenticated layout — but installing it app-wide is fine: auth-gated routes don't have a selected project to switch, so the watcher simply finds no match. Simpler than conditional mounting.
- **Use `router.replace`, not `push`**. The back button should go to whatever the user was doing before the project switch, not to the stale `/test-runs/5` page of the old project that doesn't semantically make sense in the new project.
- **Skip the initial hydration tick**. Pinia initialises `selectedProjectId` from localStorage synchronously. A naive `watch` with `immediate: true` would fire on mount and redirect the user the moment they open a deep link. Use `immediate: false` and rely on the watcher firing only on subsequent changes.
- **Guard against same-value fires**. If `setSelectedProject(sameId)` is called (e.g. from a dropdown re-selection), the watcher body checks `if (newId === oldId) return`. Vue's watcher doesn't fire on identical refs normally, but the guard is cheap insurance.
- **Drive the map by route `name`, not path**. Path matching is brittle (nested params, query strings, trailing slashes). Every redirect rule is keyed by the route name, which stays stable.
- **Redirect-to-same-route is a no-op**. For `/projects/:projectId/test-cases`, if the old and new projectId happened to match, `router.replace` to the same route with the same params is skipped by Vue Router. No extra guard needed.
- **Respect `beforeRouteLeave`**. If a view has an unsaved-changes guard, the navigation is cancelled. In that case the header switcher already committed the store change — revert by watching the navigation failure and calling `setSelectedProject(oldId)` with a toast "Save your changes first". This is a secondary behaviour; ship the core redirect first, add the revert in the same plan if cheap.
- **No server round-trip**. The redirect is a pure client-side decision. Data fetchers on the landing pages (`/test-runs`, `/projects/:id/test-cases`) already re-query on mount.

---

## Tasks

### Implementation
- [ ] Inventory current route names in `src/router/index.ts`; add missing names for the eight routes listed above
- [ ] Create `src/composables/useProjectSwitchRedirect.ts`:
  - Exported composable that installs the watcher once
  - Exported pure helper `redirectTargetForSwitch(route, newProjectId)` for unit testing
- [ ] Wire `useProjectSwitchRedirect()` into `App.vue` (or `DefaultLayout.vue`'s `setup`)
- [ ] Verify the watcher fires only on user-driven changes:
  - Reload the app on `/test-runs/5`; assert no redirect
  - Change the switcher; assert redirect to `/test-runs`
- [ ] Implement unsaved-changes revert: if `router.replace` returns a navigation failure of type `NavigationFailureType.aborted`, call `projectsStore.setSelectedProject(oldId)` and show a toast
- [ ] Manual matrix walk:
  - `/test-runs` → no redirect (already the target)
  - `/test-runs/create` → redirect to `/test-runs`
  - `/test-runs/5` → redirect to `/test-runs`
  - `/test-runs/5/execute` → redirect to `/test-runs`
  - `/test-cases` → no redirect (index; filters by selected project)
  - `/test-cases/12` → redirect to `/projects/:new/test-cases`
  - `/test-cases/12/edit` → redirect to `/projects/:new/test-cases`
  - `/projects/3/test-cases` with new project 7 → `/projects/7/test-cases`
  - `/dashboard`, `/reports`, `/projects`, `/settings` → no redirect
  - Auth pages (`/login` etc.) → no redirect
- [ ] Unit tests for `redirectTargetForSwitch`:
  - Every route-name branch
  - Null/unknown route name → null (no redirect)
  - Same projectId passed in → null
- [ ] Unit test for the composable: mock the router and store; assert `replace` is called with the expected target and `setSelectedProject(old)` is called on an aborted navigation
- [ ] E2E test `project-switch-redirect.spec.ts`:
  - Open `/test-runs/:id`, switch project via header, assert URL becomes `/test-runs`
  - Open `/test-cases/:id`, switch project, assert URL becomes `/projects/:newProjectId/test-cases`
  - Open `/dashboard`, switch project, assert URL unchanged, data reloads for new project

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes (vue-tsc clean on the new composable)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/routes-map.md` — verify the eight route names; add/correct the `name` column if it existed
- [ ] `docs/02-architecture/frontend/routing.md` — add a short "Project switcher redirects" section describing the rule and pointing at the composable
- [ ] `docs/01-product/features/001-project-management.md` (or the project-switching feature doc) — document the new navigation behaviour
- [ ] `docs/08-decisions/changelog.md` — record: chose a single app-level watcher over per-route guards; rationale
- [ ] `docs/04-execution/tech-debt.md` — log (a) harmonise `/test-cases/:id` → `/projects/:pid/test-cases/:id`, (b) cross-project "remember last location" if product ever asks
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

*(No routes-map structural change — no routes added or removed. No api-schema change. No feature doc for this standalone behaviour unless the routing doc is considered the home.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Watcher fires on initial load (localStorage hydration) and redirects a deep-linked user | High without guard | Use `watch(..., { immediate: false })`; never trigger on first read — verified by a "reload on deep link" test in the manual matrix |
| A form with unsaved changes gets destroyed without warning | Medium | Detect `NavigationFailureType.aborted` from `router.replace`; revert the store value; toast the user — implemented in the same plan |
| A new route is added later that embeds a project-scoped id and forgets to be mapped | Medium | Mapping lives in one file; routing doc calls out "add an entry to `redirectTargetForSwitch` when adding a project-scoped route"; lint-style checklist item in the PR template |
| `router.replace` to the same route triggers a Vue Router warning | Low | Guard: if `target.name === route.name && targetParamsEqual`, skip |
| Watcher runs before the router is ready in tests | Low | `useProjectSwitchRedirect` accepts injected router/store for unit tests; in the app, `App.vue` setup runs after both are installed |
| E2E test flakes because the switcher UI path isn't stable | Low | Use `data-testid="project-switcher"` on the header control; add the attribute as part of this plan if missing |
| Persisted `selectedProjectId` in localStorage is for a project the user no longer has access to — redirect lands on an empty list | Low | Out of scope; existing list pages already handle "no data" gracefully; flag as follow-up if it becomes a support issue |

---

## Definition of done

- [ ] Switching the project on any `/test-runs/*` page lands on `/test-runs`
- [ ] Switching the project on `/test-cases/:id` or `/test-cases/:id/edit` lands on `/projects/:newProjectId/test-cases`
- [ ] Switching the project on `/projects/:oldId/test-cases` lands on `/projects/:newId/test-cases`
- [ ] Switching the project on a non-project-scoped route (dashboard, reports, settings, etc.) does not change the URL
- [ ] Deep-linking into `/test-runs/5` does not redirect on load
- [ ] Unsaved-changes guard (if present) aborts the redirect and reverts the switcher
- [ ] Unit tests cover every mapping branch
- [ ] E2E test passes in CI
- [ ] Docs updated (routing.md + routes-map.md)
- [ ] PR checklist completed
