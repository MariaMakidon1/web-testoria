# Feature: Result History

## What it does

Result History is an audit trail that records every status change made to a TestResult. Each time a result's status is updated, a history entry is appended capturing the new status, a comment, who made the change, and when. This allows teams to understand how a test result evolved over the lifetime of a test run (e.g. a test that went Untested → Failed → Retest → Passed).

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | View full history for any result |
| **Lead** | View history for results in their projects |
| **Tester** | View history for results in their assigned runs |
| **Read Only** | View history read-only |

## Key behaviours

- History is displayed in `TestResultHistoryPanel.vue`, embedded in `TestResultDetail.vue`.
- Each `TestResultHistory` entry contains:
  - `id: number`
  - `test_result_id: number`
  - `status: ResultStatus` — the status recorded at that point in time (`passed|failed|blocked|no_run`)
  - `comment: string | null` — comment recorded with this status change
  - `changed_by: number` — user ID
  - `changed_at: string` — ISO timestamp
- The panel renders each entry as a timeline showing status (coloured badge), user ID, and timestamp.
- History entries are **immutable** — they cannot be edited or deleted through the UI.

## Constraints / edge cases

- History data is fetched on demand when a result is selected: `testResultsStore.fetchHistory(resultId)` calls `GET /test-results/:id/history` and caches the result in `history.value[resultId]`. On error the cache for that result is left unchanged (no silent reset).
- History is append-only; there is no mechanism to purge or archive old entries.
- The `changed_by` field stores only the user ID. A user lookup may be needed for display.
- History entries are not paginated in the current type definition — for runs with many status changes, the full array would be returned.
- Unlike some audit systems, the `TestResultHistory` schema stores only the **new** status, not an old/new pair — reconstructing the full transition sequence requires reading entries in chronological order.

## Related docs

- `src/types/testResult.ts` — `TestResultHistory` interface (lines 101–110)
- `src/components/test-runs/TestResultHistoryPanel.vue`
- `src/api/testResults.ts` — `getTestResultHistory(resultId): Promise<TestResultHistory[]>`
- `src/stores/testResults.ts`
- `docs/01-product/features/006-test-execution.md`
