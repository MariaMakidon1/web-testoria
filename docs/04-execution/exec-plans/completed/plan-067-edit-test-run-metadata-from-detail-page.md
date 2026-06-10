# Execution Plan: Edit test run metadata (name, config, assignee) from the run detail page

**Date**: 2026-04-20
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Allow users with the `tester`, `lead`, or `admin` role to edit a test run's own metadata fields — `name`, `assigned_to`, `config` (environment / browser / os / build_number), and (where valid) `status` — directly from `/test-runs/:id`, wired to `PUT /test-runs/{run_id}`.

---

## Context

The backend exposes `PUT /test-runs/{run_id}` (see `app/api/v1/test_runs.py:98`), gated by `require_role(*_TESTER)` where `_TESTER = (UserRole.TESTER, UserRole.LEAD, UserRole.ADMIN)` at line 26. The frontend already has `updateTestRun(id, data)` in `src/api/testRuns.ts:47` and `TestRunUpdate` in `src/types/testRun.ts` (`name`, `assigned_to`, `config`, `status`), but **no UI calls it**. A tester/lead/admin who creates a run with a typo in the name, the wrong environment, or the wrong assignee has no way to fix it — they must delete and recreate.

Plan 058 (active) adds edit-cases (`PUT /test-runs/{id}/cases`) from the detail page. This plan is the sibling: edit the run's own fields. They share the same page (`TestRunDetailView.vue`), the same role gate (`canManageTests`, see `src/stores/auth.ts:23`, which maps to tester-or-above — matching the backend's `_TESTER` tuple), and the same refresh-on-save pattern.

---

## Scope

### In scope

- **Detail page** (`src/views/test-runs/TestRunDetailView.vue`):
  - New "Edit run" button in the page-header actions row, visible only when `canManageTests` is true
  - Opens a dialog (`EditTestRunDialog.vue`, new) pre-filled with the current run's `name`, `assigned_to`, and `config` (environment / browser / os / build_number)
  - Save → calls `testRunsStore.updateRun(runId, patch)` → on success closes the dialog, refetches the run
  - Cancel discards changes
- **Dialog** (`src/components/test-runs/EditTestRunDialog.vue`, new):
  - Form fields mirror `TestRunCreateView` step 1: `name` (required, non-empty after trim), `assigned_to` (user picker, nullable), `config.environment`, `config.browser`, `config.os`, `config.build_number` (all optional text)
  - `status` is **not** editable from this dialog — the run has explicit transitions (`closeTestRun`, execute flow). Changing status arbitrarily is out of scope
  - Submit is disabled while the name is empty or while the patch is empty (no fields changed)
  - Send only changed fields in the patch (diff-from-original) to keep the PUT minimal and avoid accidentally overwriting server-side values
- **Store** (`src/stores/testRuns.ts`):
  - `updateRun(runId: number, patch: TestRunUpdate): Promise<TestRun>` → calls `updateTestRun` → on success replaces the run in the cached list, updates `currentRun` if it matches, returns the fresh run
- **Role gate**: `canManageTests` (tester/lead/admin) — matches backend `_TESTER`
- **Error surface**: on PUT failure, dialog stays open and shows the error via `stores/ui` notification; form is re-enabled
- **Tests**:
  - Unit: dialog pre-fills from the run prop; submitting calls the store action with only the diff; empty-name blocks submit
  - Unit: store action calls `updateTestRun` and updates `currentRun` on success
  - Unit: detail view hides the "Edit run" button when `canManageTests` is false
  - E2E: as a tester, open a run, rename it, change environment, save; the detail page shows the new values without a page reload

### Out of scope

- Editing `suite_id` / `milestone_id` / `project_id` — backend `TestRunUpdate` doesn't accept them and changing them would change the run's identity
- Editing `cases_mode` or the case set — covered by plan 058
- Editing individual results from this dialog — that belongs to the execute flow
- Bulk-edit across multiple runs
- Audit log / change history surface
- Status transitions beyond the existing buttons (close / execute) — out of scope; no arbitrary status dropdown
- Confirmation dialog on save — treat it like any other form
- Re-theming `TestRunDetailView`'s header
- Changing the backend permissions or adding a new role flag on the frontend

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| store | `src/stores/testRuns.ts` | Add `updateRun(runId, patch)` action calling `updateTestRun`; on success replace entry in `runs` list and update `currentRun` if it matches |
| view | `src/views/test-runs/TestRunDetailView.vue` | Add "Edit run" button in the actions row, gated by `canManageTests`; on click open the new `EditTestRunDialog`; on `saved` event refetch the run |
| component | `src/components/test-runs/EditTestRunDialog.vue` (new) | Dialog form with fields for `name`, `assigned_to`, `config.*`; submit diffs the form against the original run prop and calls `testRunsStore.updateRun(runId, patch)`; emits `saved` and `cancel` |
| types | `src/types/testRun.ts` | No changes — `TestRunUpdate` already covers `name`, `assigned_to`, `config`, `status` |
| tests | `tests/unit/components/EditTestRunDialog.spec.ts` (new) | Pre-fill assertion, diff-on-submit assertion, empty-name-blocks-submit assertion |
| tests | `tests/unit/stores/testRuns.spec.ts` | Extend existing spec: assert `updateRun` calls the API and replaces the cached entry |
| tests | `tests/e2e/test-run-edit.spec.ts` (new) | Tester logs in, opens a run, edits name + environment, saves, detail page shows the new values |

### Key decisions

- **Separate dialog component**. Inline editing on the detail page would clutter an already busy view; a dialog is the same pattern as create (`TestRunCreateView` wizard) and edit-cases (plan 058), so users see a consistent "open dialog → edit → save" affordance for run-level edits.
- **Diff-on-submit, not full payload**. Sending only changed fields reduces the PUT body and avoids racing a field the user didn't touch but another user edited concurrently. `TestRunUpdate` is all-optional, so the backend accepts partial patches.
- **`status` not editable here**. The run has a state machine driven by execute/close flows. An arbitrary status dropdown would let a user set a run to `completed` without finishing execution, which is almost certainly a bug source. Keep status changes to the existing purpose-built buttons.
- **`canManageTests` is the right gate**. It maps to tester-or-above, matching `_TESTER` on the backend exactly. Using `isProjectManager` (lead-or-above) would be stricter than the backend and block testers unnecessarily.
- **No optimistic update**. The list/`currentRun` updates happen on the success response to avoid a flicker/rollback on failure. The PUT is fast enough that optimism is not needed.
- **Refresh strategy**. On save, the store replaces the cached run with the server's returned object. `TestRunDetailView` watches `currentRun`, so the header fields re-render automatically without a second fetch.

---

## Tasks

### Implementation

- [ ] `src/stores/testRuns.ts` — add `updateRun(runId, patch)`; update `runs` list entry and `currentRun` on success
- [ ] `src/components/test-runs/EditTestRunDialog.vue` — create; fields for `name`, `assigned_to`, `config.environment`, `config.browser`, `config.os`, `config.build_number`; validate non-empty name; diff-on-submit
- [ ] `src/views/test-runs/TestRunDetailView.vue` — add "Edit run" button gated by `canManageTests`; wire the dialog; handle `saved` / `cancel`
- [ ] Verify user-picker assignment: reuse the existing user-select component used elsewhere in test-run create; confirm it clears cleanly when assignee is removed
- [ ] Dark-mode visual pass on the dialog

### Tests

- [ ] Unit — `EditTestRunDialog`: pre-fills fields from the passed-in run
- [ ] Unit — `EditTestRunDialog`: submit sends only the diff against the original
- [ ] Unit — `EditTestRunDialog`: empty or whitespace-only name blocks submit
- [ ] Unit — `testRunsStore.updateRun`: calls `updateTestRun`; replaces entry in `runs`; updates `currentRun` when id matches
- [ ] Unit — `TestRunDetailView`: "Edit run" button hidden when `canManageTests` is false
- [ ] E2E — tester edits a run's name and environment; detail view reflects the change without reload

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/api-schema.md` — confirm `updateTestRun` / `PUT /test-runs/{run_id}` is listed; add if missing
- [ ] `docs/01-product/features/005-test-run-management.md` (or the equivalent existing feature doc) — document that a tester/lead/admin can edit a run's metadata from the detail page
- [ ] `docs/02-architecture/ARCHITECTURE.md` — update the "Where is the thing that does X?" table with the new dialog and store action, if those sections list per-action entries
- [ ] `docs/08-decisions/changelog.md` — record: added run-metadata edit UI; gated on `canManageTests` to mirror backend `_TESTER`; status transitions intentionally excluded
- [ ] `docs/04-execution/tech-debt.md` — log: "consider a dedicated `canEditTestRun` computed on `stores/auth` if future per-project permissions diverge from `canManageTests`"
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| User edits a run that another user is executing, causing confusion | Low | Run-level fields (name, config) don't affect execution semantics; no mitigation needed beyond the existing backend concurrency handling |
| Diff-on-submit misses a field change (e.g. nested `config` equality check wrong) | Medium | Use a shallow compare per top-level field and a shallow compare for each `config.*` key; include a unit test that flips each field in isolation |
| Role gate on the button but not on the dialog route — user pastes a URL to bypass | N/A | Dialog is a child of the detail view, not a route; no direct-URL access |
| Assignee picker doesn't handle "unassign" correctly (sends `undefined` vs `null`) | Medium | Follow the create-wizard convention exactly; unit test covers both set-to-user and clear-to-null paths |
| Empty `config` object vs omitted `config` key confuses the backend | Low | When no `config.*` field changed, omit the `config` key entirely from the patch |
| Race with `closeTestRun` — user edits while another user closes | Low | Backend returns the current run; frontend replaces its cache with the response. If `status` changed server-side, the UI reflects it on the next fetch |
| Tester is not actually allowed by the backend despite the frontend gate | Low | `canManageTests` === tester-or-above; `_TESTER` === tester/lead/admin — these are the same set. Verified in `app/api/v1/test_runs.py:26` |

---

## Definition of done

- [ ] `canManageTests` users see an "Edit run" button on `/test-runs/:id`; others do not
- [ ] Clicking the button opens a dialog pre-filled with the run's name, assignee, and config
- [ ] Changing any subset of fields and clicking Save sends a minimal `PUT /test-runs/{id}` body and closes the dialog on success
- [ ] The detail page reflects the new values without a manual reload
- [ ] Empty / whitespace-only name blocks save
- [ ] Server errors keep the dialog open, show a notification, and leave the form editable
- [ ] Unit + E2E tests pass
- [ ] No new dependencies
- [ ] Docs updated (feature, api-schema, architecture where applicable, changelog)
- [ ] PR checklist completed
