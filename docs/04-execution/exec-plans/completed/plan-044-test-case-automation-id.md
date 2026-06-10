# Execution Plan: Test Case `automation_id` Field — Editor + Detail Page

**Date**: 2026-04-15
**Author**:
**Status**: Complete

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Add an optional `automation_id` text field to the test case create/edit form and surface it in the Details card on the test case detail page, so users can record and read the external automation identifier (Playwright spec, pytest node id, etc.) for any test case.

---

## Context

Test cases currently capture title, description, preconditions, steps, priority, type, status, and tags — but no link to the corresponding automated test in any external framework. Without this link there is no way for a tester reading a case to jump to the automation artifact, and no way for CI integrations to find the case from a failing automation id.

This plan depends on the companion backend plan `api-testoria/docs/04-execution/exec-plans/active/024-be-test-case-automation-id.md`, which adds the column, schemas, and exact-match filter. The frontend cannot ship until the backend is live in the target environment.

The editor view is `src/views/test-cases/TestCaseEditorView.vue`; the detail view is `src/views/test-cases/TestCaseDetailView.vue`. Both already work with the test case store (`src/stores/testCases.ts`) and the api layer (`src/api/testCases.ts`). The shared TS type lives in `src/types/testCase.ts`.

---

## Scope

### In scope
- Add `automation_id?: string | null` to the `TestCase` TS type and to any `TestCaseCreate` / `TestCaseUpdate` payloads in `src/api/testCases.ts`
- Add an `Automation ID` text input to `TestCaseEditorView.vue` (both create and edit modes — the editor handles both)
- Display the value on `TestCaseDetailView.vue` inside the existing Details card; render a placeholder dash when null/empty
- Treat empty string as null on submit (matches the backend coercion)
- Unit test for the editor's empty-string-to-null behavior; e2e for the create-with-automation-id round trip

### Out of scope
- A clickable link to the external automation tool (would require knowing the framework + base URL — out of scope)
- A list-page column for `automation_id`
- A list-page filter for `automation_id` (backend supports it; frontend filter UI deferred until users ask)
- Bulk import handling of `automation_id` (separate plan if requested)
- Copy-to-clipboard affordance on the detail page

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/testCase.ts` | Add `automation_id?: string \| null` to `TestCase` and to any create/update interfaces |
| api | `src/api/testCases.ts` | No signature change — payloads pass through; verify that `TestCaseCreatePayload` and `TestCaseUpdatePayload` include the new field |
| store | `src/stores/testCases.ts` | No structural change — store already passes whole payloads through |
| views | `src/views/test-cases/TestCaseEditorView.vue` | New `<InputText v-model="form.automation_id">` field with label, placed in the Details card next to Type/Status; on submit, coerce `""` → `null` |
| views | `src/views/test-cases/TestCaseDetailView.vue` | New `Automation ID` row in the Details grid, value or `—` placeholder when empty |

### Key decisions

- **Field placement in editor**: inside the existing Details card, after `Status` and before the Tags field. Reasons: (a) it is metadata, not narrative content, so it belongs with priority/type/status; (b) keeps the "what kind of test is this" info grouped; (c) avoids reflowing the Description/Preconditions cards.
- **Field placement in detail view**: new row in the existing Details card, directly under `Type`. Same rationale.
- **Empty string → null on submit**: matches the backend coercion (per backend plan 024) and keeps the database clean. Apply in the editor's submit handler, not in a watcher, so the form input itself stays a normal `string` (avoids null-binding edge cases with `InputText`).
- **Placeholder when missing**: render `—` (em dash) in the detail view when the value is null/empty, consistent with how other optional fields are rendered in the Details card. Verify by reading at least one existing optional row first.
- **Input validation**: only `maxlength="255"` on the `<InputText>` to mirror the backend `String(255)` cap. No regex, no framework detection — the field is intentionally free-form.
- **No conditional rendering by `type`** — the field is shown regardless of whether the case is `manual` or `automated`. A manual case may have an in-progress automation id, and an automated case may not have one yet. Decoupling matches the backend decision.

---

## Tasks

### Implementation
- [x] Add `automation_id?: string | null` to `TestCase` (and any create/update payload type) in `src/types/testCase.ts`
- [x] Verify `src/api/testCases.ts` payloads include the field (TS will surface any gap once the type is updated)
- [x] Update `TestCaseEditorView.vue`:
  - [x] Add `automation_id: ''` to the form's reactive state and to the `resetForm` / `loadFromTestCase` paths
  - [x] Add `<InputText>` field labeled "Automation ID" inside the Details card (after Status, before Tags), with `maxlength="255"` and a helpful placeholder (e.g. `e.g. tests/login.spec.ts:42`)
  - [x] In the submit handler, coerce `form.automation_id.trim() || null` before sending
- [x] Update `TestCaseDetailView.vue`:
  - [x] Add an "Automation ID" row to the Details card grid, rendering the value or `—`
- [x] Unit test: assert that submitting the editor with an empty `automation_id` sends `null` to the store action
- [x] e2e: `tests/e2e/test-case-automation-id.spec.ts` — create a case with an `automation_id`, navigate to detail, assert the value is shown; edit, clear it, assert the dash placeholder

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes (vue-tsc catches any missed type updates)
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed
- [x] Manual smoke against the real backend: create with id, edit to change id, edit to clear id, reload and confirm persistence

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` — note the new field on `createTestCase` / `updateTestCase` payloads and `TestCase` response
- [x] `docs/01-product/features/test-case-authoring.md` — describe the new field, its purpose, and the empty-to-null behavior
- [x] `docs/08-decisions/changelog.md` — record placement, empty-to-null, decoupled-from-type decisions
- [x] This plan moved from `active/` to `completed/`
- [x] PR review and merge

*(No routes-map update — no route changes. No store doc update — store structure unchanged.)*

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend plan 024 not yet merged when this lands | High | Sequence: backend plan ships first; gate this plan's merge on backend availability in the target environment |
| Form submit sends `""` instead of `null`, polluting the database | Medium | Coerce in the submit handler and assert via unit test; backend also coerces as defense-in-depth |
| Long automation ids overflow the Details grid layout | Low | `word-break: break-all` on the value cell; visual check with a 200-char id |
| Stale `loadFromTestCase` path forgets to copy `automation_id` into the form | Medium | Test edits an existing case with a value, then reloads — covered in e2e |

---

## Definition of done

- [x] Editor (create + edit) shows an `Automation ID` text field that round-trips through the backend
- [x] Submitting an empty value persists `null`, not `""`
- [x] Detail page shows the value in the Details card, or `—` when empty
- [x] All hard invariants respected — no component imports from `src/api/`
- [x] Unit and e2e tests pass
- [x] PR checklist completed
- [x] Docs updated
