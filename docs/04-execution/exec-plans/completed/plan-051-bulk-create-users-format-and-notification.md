# Execution Plan: Bulk Create Users — Format Text + Post-Success Refetch

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Fix three UX bugs on the bulk-create-users dialog in `UserListView.vue`: (a) the instruction snippet misleads users into thinking `full_name` and `role` are optional, (b) nothing refetches the users list after a successful bulk create so the new rows don't appear, and (c) the dialog close / toast logic is muddy when some rows succeed and some fail.

---

## Context

The bulk-create dialog lives in `src/views/users/UserListView.vue`. Three specific spots:

1. **Instruction text** (line 433): `<code>username,email,password[,full_name][,role]</code>` — the square brackets advertise `full_name` and `role` as optional. In practice users frequently skip them and then wonder why the created accounts have blank names and default roles they didn't intend.
2. **Post-success handling** (lines 216–242): `handleBulkCreate` shows a toast and — only if `result.created.length > 0` — closes the dialog and clears the textarea. It **never calls `usersStore.fetchUsers()`**, so the list on the page stays stale until a manual refresh. The user reports this as "created users but they're not in the list".
3. **Ambiguous close logic**: the dialog closes even on partial success, hiding the error detail from the user the moment it becomes actionable (they need to fix the failed lines and re-submit).

The CSV parser at lines 178–204 already reads all five fields (`username, email, password, full_name, role`) in the order the user wants displayed — no parser change required. The backend `POST /users/bulk` endpoint is stable (`api-testoria/app/api/v1/users.py:62`) and its schemas accept exactly this payload, so **no API plan is needed**.

---

## Scope

### In scope
- Update the instruction snippet at line 433 to `username,email,password,full_name,role` (no brackets) and adjust the paragraph wording to match
- Update the placeholder example at lines 443–444 to keep aligned with the new snippet (it already uses all 5 fields, verify)
- Update the `bulk-hint` paragraph at lines 435–438 so that it stops implying `role` is optional / default=tester; instead document the allowed roles
- After `handleBulkCreate` completes successfully, call `usersStore.fetchUsers()` to refresh the list
- Rework the close/toast logic:
  - **Full success** (`errors.length === 0`, `created.length > 0`) → success toast, close dialog, clear textarea, refetch users list
  - **Partial success** (`created.length > 0 && errors.length > 0`) → warn toast listing failed rows, **keep dialog open**, do not clear textarea, refetch users list (so the created rows appear immediately while the user resolves the failures)
  - **Full failure** (`created.length === 0`) → error toast, keep dialog open, do not clear textarea, **no refetch**
- Client-side validation warning when any line is missing `full_name` or `role` (warn, do not block — submit still allowed, because the backend defaults remain valid)
- Unit test the validation + branching logic (pure function extracted from `handleBulkCreate`)
- e2e smoke: open dialog, paste 3 valid rows, submit, assert dialog closes and the list now shows 3 new users

### Out of scope
- File-upload CSV (drag-and-drop or file picker) — still paste-only
- Header row / real CSV parsing (quoted values, embedded commas) — still naive split on `,`
- Changing any backend schema, service, or endpoint
- Making `full_name` or `role` strictly required server-side
- Redesigning the dialog layout or adding a progress indicator
- Importing from Excel

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/users/UserListView.vue` | Update instruction snippet and hint text; split `handleBulkCreate` into a small pure parser/validator + an async submit handler; call `usersStore.fetchUsers()` on success and partial success; rework dialog close logic; tighten error toast formatting |
| composables (optional) | `src/composables/useBulkUserCsv.ts` (new, only if unit-testing inline becomes awkward) | Pure `parseBulkCsv(text): { users: UserCreate[]; errors: string[] }` extracted from `handleBulkCreate` so it can be unit-tested without Vue |
| store | `src/stores/users.ts` | No structural change — `fetchUsers()` already exists; verify it is exposed on the store and callable from the view |

### Key decisions

- **Keep dialog open on partial success**: the user needs to see which rows failed *while the textarea still holds them* so they can edit and resubmit. Closing the dialog on partial success is the current bug — do not preserve that behavior "just in case".
- **Refetch on partial success too**: the successfully created rows should land in the list immediately even if some failed. Do not gate the refetch on `errors.length === 0`.
- **Do not refetch on full failure**: nothing changed server-side, a refetch would be wasted.
- **Instruction snippet shows all 5 fields without brackets**: the visual contract of the snippet is "this is what you should type". Optional-looking brackets invite users to skip fields and then be surprised.
- **Client-side "missing fields" warning, not a hard block**: the backend still accepts rows with `full_name` null and `role` defaulted to `tester`. Blocking on the client would be more restrictive than the backend, and that's a wrong direction for a bulk tool. A warn toast is enough — the user is told, they can still submit.
- **Pure parser extraction**: moving the parse/validate logic out of the async handler makes it unit-testable and keeps `handleBulkCreate` focused on IO + UI state. Only extract if the test becomes awkward inline — do not force a new file if two lines of inline logic is all it takes.
- **Error toast cap**: the current code interpolates every error into a single toast string (`e.username: e.error`). On 50 failed rows that is unreadable. Cap the toast at the first 3 errors with "…and N more", and log the full list to console or put a collapsible error panel inside the dialog. Go with the collapsible panel inside the dialog since keeping the dialog open already leaves space for it — better UX than a truncated toast.
- **Inline error panel inside the dialog**: when errors exist, render a small list above the textarea footer showing `row index + username + error`. Users fix and resubmit without leaving the dialog.
- **Do not reset the selected-project filter or the users list scroll position** on refetch — `fetchUsers()` should update state in place without disrupting the viewport.

---

## Tasks

### Implementation
- [x] Update line 433 snippet text to `username,email,password,full_name,role`
- [x] Update line 431–432 paragraph wording if it hints at optionality ("in CSV format, all fields required")
- [x] Update lines 435–438 hint text: remove "Default: tester" (still true, but misleading in context); keep "Valid roles: admin, lead, tester, read_only, no_access" and "Max 100 users"
- [x] Verify the placeholder at lines 443–444 still matches the new column order
- [x] In `handleBulkCreate`:
  - [x] After `result = await usersStore.bulkCreateUsers(...)`, branch on success level (full / partial / full failure)
  - [x] On full success: success toast, refetch, close dialog, clear textarea, clear any inline errors
  - [x] On partial success: warn toast (short summary), refetch, **do not close**, **do not clear textarea**, populate an inline error list shown above the dialog footer
  - [x] On full failure: error toast, no refetch, no close, populate inline error list
- [x] Add a reactive `bulkErrors` ref for the inline error list; clear on dialog close and on successful resubmit
- [x] Add client-side "missing fields" warn toast when any parsed row has an empty `full_name` or `role` (non-blocking)
- [x] Verify `usersStore.fetchUsers()` exists and preserves the list's filter/pagination state; if not, add a refetch action that does
- [x] Unit test the parser/validator (extracted helper or inline function) for: valid 5-field rows, rows with missing `full_name` (warn), rows with fewer than 3 fields (reject), whitespace handling
- [x] Unit test the branching: mock `usersStore.bulkCreateUsers` returning the three result shapes (full/partial/failure) and assert the dialog state + refetch call
- [x] e2e: `tests/e2e/user-bulk-create.spec.ts` — valid batch creates users, dialog closes, list shows new rows; partial batch keeps dialog open with inline errors; full failure shows error toast

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (including new unit tests)
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke against the real backend: 3-row success, 3-row partial (one duplicate username), full failure (empty textarea, too many rows), each of the warn-but-allow paths (missing full_name, missing role)

### Docs update (Phase 5)
- [x] `docs/01-product/features/` — update the user management feature doc to describe the new bulk-create UX (refetch on success, stay-open on partial, inline error panel)
- [x] `docs/08-decisions/changelog.md` — record: five-field display (no brackets), stay-open on partial, refetch on success+partial, inline error panel, client-side warn-but-allow on missing optional fields
- [x] `docs/04-execution/tech-debt.md` — log "proper CSV parsing (header row + quoted values)" and "file-upload support" as follow-ups
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map / api-schema update — no API contract change.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `usersStore.fetchUsers` resets pagination / sort and disorients the user | Medium | Verify the action preserves filter state; if not, capture state before refetch and restore after |
| The inline error panel pushes the dialog below the fold on short viewports | Medium | Cap the panel height with overflow-y-scroll; test on laptop-height viewports |
| Users who *rely* on the old "closes on any success" behavior feel the new flow is slower | Low | The new flow is strictly more informative — call it out in the changelog entry |
| A row with `full_name` containing a literal comma breaks the naive split | Medium | Documented limitation; flagged as tech debt for a proper parser follow-up; warn in the hint text that commas inside fields are not supported yet |
| Backend returns a shape the branching logic doesn't expect (e.g. `created: null`) | Low | Defensive default (`result.created ?? []`, `result.errors ?? []`) in the branching code |
| Refetch races with another user action and overwrites in-flight state | Low | `usersStore.fetchUsers` is idempotent; the race only costs a flicker at worst |

---

## Definition of done

- [x] Instruction snippet reads `username,email,password,full_name,role` (no brackets) and the surrounding paragraph matches
- [x] On full success, the dialog closes, the textarea clears, a success toast appears, and the users list reflects the new rows without a manual refresh
- [x] On partial success, the dialog stays open, the created rows appear in the list, and an inline error panel lists the failed rows
- [x] On full failure, the dialog stays open, the textarea is preserved, and the users list is unchanged
- [x] Missing-optional-fields produce a client-side warn toast but still allow submission
- [x] Unit tests cover the parser and the branching; e2e covers the three outcomes
- [x] PR checklist completed
- [x] Docs updated
