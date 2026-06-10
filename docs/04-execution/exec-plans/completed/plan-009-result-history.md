# Execution Plan: 009 — Result History

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Implement the full result history feature in the frontend: API function, store action, and wiring to `TestResultHistoryPanel` — currently the type is defined but no frontend code fetches or displays history data.

---

## Context

`TestResultHistory` is defined in `src/types/testResult.ts` and `TestResultHistoryPanel.vue` exists as a component, but `src/api/testResults.ts` has no `getTestResultHistory()` function and `testResultsStore` has no corresponding action. The panel renders nothing. This is a complete frontend implementation gap — the highest-priority fix identified in the analysis.

---

## Scope

### In scope
- `getTestResultHistory(resultId)` API function in `src/api/testResults.ts`
- Mock implementation in `src/mock/api/testResults.mock.ts`
- `fetchHistory(resultId)` action and `history` state in `testResultsStore`
- Wire `TestResultHistoryPanel` to the store — render the timeline on `TestResultDetail` load
- Unit tests for history fetch and rendering

### Out of scope
- History pagination (the type has no pagination — deferred if volume becomes a concern)
- Filtering or searching history entries

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| api | `src/api/testResults.ts` | Add `getTestResultHistory(resultId: number): Promise<TestResultHistory[]>` → `GET /test-results/:id/history` |
| mock | `src/mock/api/testResults.mock.ts` | Add `mockGetTestResultHistory(resultId)` — derive history from status changes recorded in mock state |
| store | `src/stores/testResults.ts` | Add `history: Record<number, TestResultHistory[]>` state; add `fetchHistory(resultId)` action |
| components | `src/components/test-runs/TestResultHistoryPanel.vue` | Read history from store; render timeline entries (status badge, `changed_by_name`, `changed_at`, optional comment/message) |
| views | `src/views/TestRunExecutionView.vue` | Call `fetchHistory` when a result is selected/opened |
| tests | `tests/unit/stores/testResults.spec.ts` | Extend — history fetch, empty history, multiple entries |

### Key decisions

- History state is keyed by `resultId` in the store (`Record<number, TestResultHistory[]>`) so multiple results' histories can be cached without re-fetching.
- The mock generates synthetic history by recording a single "Untested → {current status}" entry for any result that has been updated — sufficient for development and testing.
- `changed_by_name` is rendered directly (no extra user lookup) since it is denormalised on the history entry.

---

## Tasks

### Implementation
- [ ] Add `getTestResultHistory` to `src/api/testResults.ts`
- [ ] Add `mockGetTestResultHistory` to mock file
- [ ] Add `history` state and `fetchHistory` action to `testResultsStore`
- [ ] Wire `TestResultHistoryPanel` to store data
- [ ] Call `fetchHistory` on result selection in execution view
- [ ] Extend `testResults` unit tests with history coverage

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/06-generated/api-schema.md` updated (new endpoint)
- [ ] `docs/01-product/features/009-result-history.md` updated — remove "not yet implemented" caveat
- [ ] `docs/04-execution/tech-debt.md` — no new debt added
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Backend `GET /test-results/:id/history` endpoint may not exist yet | Medium | Feature works fully in mock mode; backend endpoint is a separate task |
| History entries accumulate fast in active runs — large arrays | Low | No pagination now; add to tech debt if >100 entries per result becomes common |

---

## Definition of done

- [ ] `TestResultHistoryPanel` renders real history data in mock mode
- [ ] History loads when a result is opened in the execution view
- [ ] Empty history shows an appropriate empty state
- [ ] Unit tests passing
