# Execution Plan: Wire up "Link Defect" on `/test-runs/:id` so the add / remove actions actually persist

**Date**: 2026-04-20
**Author**:
**Status**: Draft

---

## Goal

Make the Defects section on `/test-runs/:id` actually save. Today the `<DefectsPanel>` emits `add-defect` / `remove-defect`, but the parent (`TestResultDetail.vue:596`) doesn't listen — so clicking "Link Defect" opens the dialog, fills the form, closes it, and does nothing. No PATCH, no store update, no persisted change. Wire the emits through to a store action that calls the existing `PATCH /test-results/{id}` with the updated `defects` array.

---

## Context

### Current wiring

```vue
<!-- src/components/test-runs/TestResultDetail.vue:596 -->
<DefectsPanel :defects="result.defects || []" :result-id="result.id" />
```

The panel itself is ready to work:

```ts
// src/components/test-runs/DefectsPanel.vue:15-19
const emit = defineEmits<{
  (e: "add-defect", defect: Defect): void;
  (e: "remove-defect", key: string): void;
}>();
```

It just has no listener on the parent side. The `result-id` prop is being passed but also not used — the panel doesn't know what to do with it (it's not a container).

### Backend contract

`TestResult.defects` is a JSON column (`app/models/test_result.py:59`) writable via the existing `PATCH /test-results/{id}`:

```py
# app/schemas/test_result.py:30
class TestResultUpdate(BaseModel):
    ...
    defects: list[Any] | None = None
```

Send the new full list; the server stores it. No BE change is required for this plan. (A dedicated `POST /test-results/{id}/defects` + `DELETE /test-results/{id}/defects/{key}` pair would be slightly more natural and atomic under concurrent edits, but that's nice-to-have, not required — logged as a follow-up.)

### Why the defects update is "replace, not patch"

Because the column is a JSON list, any add / remove is sent as the **full new array**. This is fine for the typical single-user, low-frequency defect-linking flow; the risk is a lost-update under concurrent edits (two testers link different defects simultaneously and one overwrites the other). Acceptable for v1; mitigation logged.

### Existing store

`src/stores/testResults.ts` already has an `updateResult(resultId, patch)` action that calls `testResultsApi.updateTestResult(resultId, patch)` (used by the execute-view comment save path). The new defect-add / defect-remove actions go through the same method — no new API client code is needed.

---

## Scope

### In scope (page `/test-runs/:id` only, file: `TestResultDetail.vue` + `testResults.ts` store)

- `TestResultDetail.vue`:
  - Listen to `@add-defect` and `@remove-defect` on `<DefectsPanel>`
  - Handlers compute the new `defects` array from the result's current list and delegate to the store
  - After the store action resolves, the `selectedResult` / `result` prop reflects the change (the store updates the in-memory result)
  - Show a transient error toast if the PATCH fails, and revert the optimistic update
  - Pass `result.id` into the handlers (already available via the `result` prop — drop the now-unused `result-id` prop from `DefectsPanel`)
- `src/stores/testResults.ts`:
  - Add `addDefectToResult(resultId, defect)` — reads the current result from state, appends the defect (deduped by `key`), calls `updateResult(resultId, { defects: [...current, defect] })`
  - Add `removeDefectFromResult(resultId, key)` — filters the key out, calls `updateResult(resultId, { defects: [...filtered] })`
  - Both actions return the updated result and refresh the store entry so other subscribers (history panel timestamps, detail panel, progress) see the change
  - Optimistic update: immediately patch the in-memory `results[i].defects`; on failure, restore the pre-change list and surface a toast
- Dedup rule: two defects with the same `(tracker, key)` are the same defect — the "Link Defect" dialog doesn't add a duplicate; the store's add helper is idempotent
- Dialog behaviour: after a successful add, the dialog closes, the table row appears; a failed add keeps the dialog open with an error message
- Unit tests:
  - Store: add → state reflects the new list; remove → state reflects the filtered list; add-duplicate is a no-op
  - Store: failure path restores the previous list
  - Component: `TestResultDetail` handler calls the right store action with the right payload
- E2E: open a result on `/test-runs/:id`, link a defect, confirm the row appears in the table and survives a page reload

### Out of scope

- Dedicated backend endpoints for link/unlink — logged as follow-up (BE is sufficient today)
- Server-side deduplication of defects within a list — current client-side dedup is enough; backend accepts whatever the client sends
- Jira / GitHub integrations (real tracker lookups, validation of issue existence) — separate plan
- Defects on synthetic "no_run" rows (plan 055) — those rows have `id === null`; the panel is already guarded against this by the panel visibility condition on the parent (result detail renders only when the result is real)
- Changing the `Defect` type / schema
- Reflecting defect changes in the `ResultHistory` log (no backend field for it today — logged as a follow-up idea)
- Wiring the execution view's defect field (already works via its submit flow — different code path)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-runs/DefectsPanel.vue` | Remove the unused `result-id` prop (or leave it; it's harmless — prefer removing to clarify contract); no behavioural change |
| components | `src/components/test-runs/TestResultDetail.vue` | Add `@add-defect` / `@remove-defect` handlers; delegate to the store; optimistic update with error rollback + toast |
| store | `src/stores/testResults.ts` | `addDefectToResult(resultId, defect)`, `removeDefectFromResult(resultId, key)` — call existing `updateResult` / `updateTestResult` API |
| api | `src/api/testResults.ts` | No change — `updateTestResult(resultId, patch)` already handles the `defects` field |
| tests | `tests/unit/stores/testResults.spec.ts` | Add / remove / failure scenarios |
| tests | `tests/unit/components/TestResultDetail.spec.ts` | Add / remove emits dispatch the right store action |
| e2e | `tests/e2e/test-run-detail.spec.ts` | Link a defect end-to-end |

### Key decisions

- **Fix is on the parent, not the panel.** `DefectsPanel` is a view-layer component. Parent-owned state mutation via store action is the established pattern (same shape as the comment / status flows).
- **Full-array replace for defects.** Matches the JSON-column contract on the backend. Concurrency risk (lost updates) is acceptable; logged for tracking.
- **Optimistic update with rollback.** Latency on add is minimal and the UX of "click → appear" is clearly better than "click → spinner → appear". Rollback on failure keeps the state consistent.
- **Dedupe by `(tracker, key)` at the store layer.** A client that double-fires an add (double-click, network retry) shouldn't double-list a defect. Cheap guard; unit-tested.
- **No new endpoint.** Covered by existing PATCH. A dedicated pair of link/unlink endpoints is a cleanup, not a fix; logged as follow-up.
- **Drop the unused `result-id` prop from `DefectsPanel`.** Reduces confusion for the next reader who'd expect the panel to self-manage. Parent owns the container logic.
- **Error surface.** Reuse the app's existing toast service (same as other PATCH errors); don't invent a new error component.

---

## Tasks

### Implementation
- [ ] `DefectsPanel.vue`: remove the unused `resultId` prop (and its usage declarations); visual unchanged
- [ ] `TestResultDetail.vue`:
  - [ ] Bind `@add-defect="handleAddDefect"` and `@remove-defect="handleRemoveDefect"` on `<DefectsPanel>`
  - [ ] `handleAddDefect(defect)` — call `testResultsStore.addDefectToResult(result.id, defect)`; await; toast on error
  - [ ] `handleRemoveDefect(key)` — call `testResultsStore.removeDefectFromResult(result.id, key)`; await; toast on error
- [ ] `stores/testResults.ts`:
  - [ ] Add `addDefectToResult(resultId, defect)`:
    - [ ] Find the current result in `results` / `current` refs
    - [ ] If the defect with same `(tracker, key)` already present → no-op, return
    - [ ] Optimistically update in-memory `defects` list
    - [ ] Call `testResultsApi.updateTestResult(resultId, { defects: [...newList] })`
    - [ ] On failure: restore the previous `defects` list; rethrow so the UI can toast
  - [ ] Add `removeDefectFromResult(resultId, key)`:
    - [ ] Compute filtered list
    - [ ] Optimistic update + API call + rollback on failure
  - [ ] Ensure the updated result from the API response replaces the in-memory copy (consistent with `updateResult` pattern)
- [ ] Unit tests:
  - [ ] `addDefectToResult` success: in-memory list grows; API called with full new array
  - [ ] `addDefectToResult` duplicate (same tracker + key): no API call; state unchanged
  - [ ] `addDefectToResult` API failure: state restored to pre-add; action throws
  - [ ] `removeDefectFromResult` success: in-memory list shrinks; API called correctly
  - [ ] `removeDefectFromResult` unknown key: no API call; state unchanged (log a warning)
  - [ ] `removeDefectFromResult` API failure: state restored; action throws
  - [ ] `TestResultDetail` emits: `add-defect` → store called with `(result.id, defect)`; `remove-defect` → store called with `(result.id, key)`
- [ ] E2E:
  - [ ] Open `/test-runs/:id`; select any executed result
  - [ ] Click "Link Defect"; fill tracker + key; submit; assert row appears in the table
  - [ ] Reload page; assert the defect persists (confirms the PATCH actually hit)
  - [ ] Click the trash icon on a row; confirm it disappears and the reload still reflects removal
  - [ ] Try linking the same tracker + key twice: second attempt is a no-op (no duplicate row, no error)
- [ ] Manual: dark-mode rendering; the table is empty-state friendly when the last defect is removed
- [ ] Manual: error path — temporarily break the network; confirm the row reverts and a toast surfaces

### Quality check (Phase 4)
- [ ] `npm run lint`
- [ ] `npm run test -- --run`
- [ ] `npm run build` (vue-tsc flags any dead `resultId` prop if we remove it)
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/01-product/features/006-test-execution.md` (or equivalent) — describe that linking defects on the detail page persists via `PATCH /test-results/{id}`
- [ ] `docs/02-architecture/frontend/components.md` — note that `DefectsPanel` is view-only; container wiring lives in `TestResultDetail`
- [ ] `docs/02-architecture/frontend/state-management.md` — document `addDefectToResult` / `removeDefectFromResult` helpers
- [ ] `docs/08-decisions/changelog.md` — record: fixed "Link Defect" on `/test-runs/:id` (was silently no-op); optimistic update with rollback; rejected alternative (new backend endpoints) as unnecessary
- [ ] `docs/04-execution/tech-debt.md` — log follow-ups: (a) dedicated `POST /test-results/{id}/defects` + `DELETE …/defects/{key}` endpoints for atomic edits, (b) record defect link/unlink as a ResultHistory event if product wants the audit trail, (c) tracker integrations for URL validation / issue existence checks
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Concurrent edits from two users overwrite each other's defects list | Low | Accepted for v1; follow-up plan for atomic link/unlink endpoints |
| Optimistic update hides a real PATCH failure if the rollback is silent | Low | Rollback + user-visible toast; unit test asserts both |
| A stale `result.defects` is passed because the store hasn't refreshed | Low | Action reads from the store, not from the component prop; the store is the source of truth for the update input |
| Removing the `resultId` prop breaks a test that asserts the prop exists | Low | `vue-tsc` / unit tests catch it; remove any stale assertions |
| `PATCH /test-results/{id}` also touches `tested_at` / `tested_by` server-side, causing surprising fields to change after a defect add | Medium | Confirm backend behaviour; if the side effect is real and undesired, file a BE follow-up to scope PATCH to only the supplied fields |
| Duplicate-key defects differ by `url` or `summary` and the user intended to update, not dedupe | Low | Dedupe by `(tracker, key)` only; same tuple is "already linked"; update flow can be a separate UX plan if needed |
| Synthetic `no_run` results (plan 055) slip through and the handler tries to PATCH `id: null` | Low | `TestResultDetail` only renders for `result.id != null`; add an `if (!result.id) return` guard in both handlers as defence in depth |

---

## Definition of done

- [ ] "Link Defect" dialog submission on `/test-runs/:id` persists: a PATCH hits the backend and the row appears in the table
- [ ] Removing a defect persists: the row disappears and survives a reload
- [ ] Duplicate `(tracker, key)` add is a no-op — no duplicate row, no API call, no error
- [ ] PATCH failure reverts the optimistic UI and surfaces a toast
- [ ] Store helpers `addDefectToResult` / `removeDefectFromResult` are the only way this panel's mutations reach the API
- [ ] Unit + e2e tests cover add / remove / duplicate / failure
- [ ] No new backend endpoints introduced
- [ ] Docs updated; follow-ups logged (atomic endpoints, history audit, tracker integrations)
- [ ] PR checklist completed
