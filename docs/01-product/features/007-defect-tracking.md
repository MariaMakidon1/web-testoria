# Feature: Defect Tracking

## What it does

Defect Tracking allows testers to link external bug/issue records to a TestResult when a test fails. Testoria does not host a bug tracker itself — instead it stores a reference (tracker type, key, URL, summary) that links out to an external system such as Jira, GitHub Issues, GitLab Issues, or a custom tracker. Multiple defects can be linked to a single result.

## Who uses it

| Role | Capabilities |
|------|-------------|
| **Admin** | Add, edit, remove defects on any result |
| **Lead** | Add, edit, remove defects on results in their projects |
| **Tester** | Add, edit, remove defects on results (`canManageTests`) |
| **Read Only** | Read-only — view linked defects only |

## Key behaviours

- `DefectsPanel.vue` is embedded inside the execution detail view (`TestResultDetail`).
- Supported **tracker types** (field name: `tracker`): `'jira'`, `'github'`, `'gitlab'`, `'custom'`.
- A `Defect` record contains:
  - `tracker: 'jira' | 'github' | 'gitlab' | 'custom'` — required
  - `key: string` — required (e.g. `PROJ-123`, `#42`)
  - `url?: string` — optional link to the external issue
  - `summary?: string` — optional short description
- Note: there is no `status` field on the Defect type — defect open/closed state is not tracked in Testoria.
- Multiple defects can be linked to the same TestResult.
- Adding or removing defects calls `updateTestResult` with the full updated `defects` array — there is no separate atomic add/remove endpoint.
- Defects are displayed as clickable links (opening `url` in a new tab) with a badge showing `tracker` and `key`.
- `DefectsPanel.vue` validates `tracker` and `key` inline on submit — both fields are required. Inline error messages appear below each field if the user tries to submit without them.
- `TestResultCard.vue` shows a **defect count badge** (bug icon + count) when one or more defects are linked to the result.
- `TestResultsList.vue` header shows a total defect chip across all results in the run.

## Constraints / edge cases

- Testoria does **not** integrate with external tracker APIs — there is no OAuth or webhook sync. All defect data is manually entered.
- Defect `url` is optional and stored as-is; no URL validation is enforced beyond basic format checks on the form.
- Removing a defect link does not affect the external tracker — it only removes the reference from Testoria.
- Defects are nested inside the TestResult payload, not a standalone resource — they have no independent ID in the API. The frontend must always send the full updated defects array on update.
- Defect changes are persisted via the backend as part of the TestResult update.

## Related docs

- `docs/06-generated/api-schema.md` — `testResults` API (`defects` is part of `TestResultUpdate`)
- `src/types/testResult.ts` — `Defect` interface (line 38)
- `src/components/test-runs/DefectsPanel.vue`
- `src/stores/testResults.ts`
- `src/api/testResults.ts`
- `docs/01-product/features/006-test-execution.md`
