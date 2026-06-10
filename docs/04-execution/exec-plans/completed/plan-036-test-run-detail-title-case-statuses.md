# Execution Plan: Title Case Status Labels on Test Run Detail Page

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-036-test-run-detail-title-case-statuses.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Display result status names (passed, failed, blocked, skipped) in Title Case on the test run detail page and the test run execution page using the existing `RESULT_STATUS_LABELS` constant.

---

## Context

On `/test-runs/:id`, the status breakdown section (line 191) renders `{{ status }}` which outputs the raw object key in lowercase: `passed`, `failed`, `blocked`, `skipped`. The `RESULT_STATUS_LABELS` constant already exists in `types/testResult.ts` with Title Case values (`Passed`, `Failed`, `Blocked`, `Skipped`) — it's just not imported or used on this page.

The same issue applies to the test run's own status Tag (lines 119, 204) which shows the raw run status (`planned`, `in_progress`, `completed`, `aborted`) in lowercase.

On the execution page (`/test-runs/:id/execute`), the status filter dropdown (`TestRunExecutionView.vue` line 636) renders `{{ status }}` as lowercase in the `<option>` elements. The status action buttons (Passed, Failed, etc.) are already Title Case, but the filter dropdown and the priority Tag for the selected test case (line 684) show raw lowercase values.

---

## Scope

### In scope

- Import `RESULT_STATUS_LABELS` in `TestRunDetailView.vue` and use it for the status breakdown labels
- Add a `RUN_STATUS_LABELS` mapping (or inline Title Case transform) for the test run status Tag
- Fix the status filter dropdown in `TestRunExecutionView.vue` to show Title Case options
- Fix the priority Tag for the selected test case in `TestRunExecutionView.vue` to use `PRIORITY_LABELS` and `getPrioritySeverity` (instead of inline conditional)

### Out of scope

- Changing status colors or icons (already correct)
- Changing the status action buttons on the execution page (already Title Case)

---

## Technical approach

### 1. Status breakdown labels (line 191)

**Current:**
```vue
<span class="breakdown-label">{{ status }}</span>
```

**Fix:**
```vue
<span class="breakdown-label">{{ RESULT_STATUS_LABELS[status as ResultStatus] || status }}</span>
```

Import at the top:
```ts
import { RESULT_STATUS_COLORS, RESULT_STATUS_LABELS } from "@/types/testResult";
import type { ResultStatus } from "@/types/testResult";
```

### 2. Test run status Tag (lines 119, 204)

**Current:**
```vue
<Tag :value="testRunsStore.currentTestRun.status" ... />
```

**Fix** — add a run status labels map (these are test run statuses, not result statuses):
```ts
const RUN_STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  aborted: "Aborted",
};
```

Then:
```vue
<Tag :value="RUN_STATUS_LABELS[testRunsStore.currentTestRun.status] || testRunsStore.currentTestRun.status" ... />
```

If `RUN_STATUS_LABELS` would be useful elsewhere, add it to `types/testRun.ts` as an exported constant. Otherwise keep it local.

### 3. Execution page — status filter dropdown (line 636)

**Current:**
```vue
<option v-for="status in RESULT_STATUSES" :key="status" :value="status">
  {{ status }}
</option>
```

**Fix:**
```vue
<option v-for="status in RESULT_STATUSES" :key="status" :value="status">
  {{ RESULT_STATUS_LABELS[status] }}
</option>
```

Import `RESULT_STATUS_LABELS` (add to the existing import from `@/types/testResult`).

### 4. Execution page — selected test case priority Tag (lines 683-692)

**Current** — inline severity conditional:
```vue
<Tag
  :value="selectedTestCase.priority"
  :severity="selectedTestCase.priority === 'critical' ? 'danger' : selectedTestCase.priority === 'high' ? 'warning' : 'info'"
/>
```

**Fix** — use shared `getPrioritySeverity` (from Plan 035) and `PRIORITY_LABELS`:
```vue
<Tag
  :value="PRIORITY_LABELS[selectedTestCase.priority] || selectedTestCase.priority"
  :severity="getPrioritySeverity(selectedTestCase.priority)"
/>
```

Import from `@/types/testCase`:
```ts
import { PRIORITY_LABELS, getPrioritySeverity } from "@/types/testCase";
```

Note: `getPrioritySeverity` is being centralized in Plan 035. If this plan executes after Plan 035, import the shared function. If before, add a local copy with lowercase keys.

### 5. Execution page — Save button uses wrong severity (line 857-865)

**Current:**
```vue
<Button
  label="Save"
  icon="pi pi-save"
  severity="secondary"
  outlined
  :loading="isSaving"
  ...
/>
```

The Save button uses `severity="secondary" outlined` which renders it in muted gray — it doesn't look like a primary action. It should use the default (primary) severity to be visually consistent with the button convention (Plan 028).

**Fix** — remove `severity="secondary"` and keep `outlined`:
```vue
<Button
  label="Save"
  icon="pi pi-save"
  outlined
  :loading="isSaving"
  ...
/>
```

This gives it the primary color outline, making it clearly actionable while remaining visually subordinate to the status buttons (Passed/Failed/Blocked/Skipped) which are filled primary-action buttons.

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/test-runs/TestRunDetailView.vue` | Import `RESULT_STATUS_LABELS`; use for breakdown labels; add/import `RUN_STATUS_LABELS` for run status Tag |
| views | `src/views/test-runs/TestRunExecutionView.vue` | Import `RESULT_STATUS_LABELS`; use for filter dropdown options; import `PRIORITY_LABELS` + `getPrioritySeverity` for selected test case Tag; change Save button from `severity="secondary"` to default (primary) |
| types | `src/types/testRun.ts` (optional) | Export `RUN_STATUS_LABELS` if not already present |

### Key decisions

- **Use existing `RESULT_STATUS_LABELS`**: Already defined with correct Title Case values. No need to create a new utility or inline `capitalize()`.
- **Separate labels for run status vs result status**: Run statuses (`planned`, `in_progress`, etc.) are different from result statuses (`passed`, `failed`, etc.). Each gets its own labels map.

---

## Tasks

### Implementation

- [x] Import `RESULT_STATUS_LABELS` and `ResultStatus` type in `TestRunDetailView.vue`
- [x] Replace `{{ status }}` with `{{ RESULT_STATUS_LABELS[status] }}` in the breakdown section (line 191)
- [x] Add `RUN_STATUS_LABELS` map (local or in `types/testRun.ts`)
- [x] Use `RUN_STATUS_LABELS` for the test run status Tag at lines 119 and 204
- [x] Import `RESULT_STATUS_LABELS` in `TestRunExecutionView.vue` (add to existing import)
- [x] Replace `{{ status }}` with `{{ RESULT_STATUS_LABELS[status] }}` in the filter dropdown (line 636)
- [x] Import `PRIORITY_LABELS` and `getPrioritySeverity` in `TestRunExecutionView.vue`
- [x] Replace inline priority severity conditional (lines 683-692) with `getPrioritySeverity` and `PRIORITY_LABELS`
- [x] Change Save button (line 860): remove `severity="secondary"`, keep `outlined` for primary color outline
- [x] Verify all statuses display in Title Case on both pages
- [x] Verify Save button renders with primary color outline

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note Title Case status labels fix
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| None — uses existing constant, template-only change | N/A | N/A |

---

## Definition of done

- [x] Status breakdown shows: Passed, Failed, Blocked, Skipped (Title Case) on `/test-runs/:id`
- [x] Test run status Tag shows: Planned, In Progress, Completed, Aborted (Title Case) on `/test-runs/:id`
- [x] Status filter dropdown shows: Passed, Failed, Blocked, Skipped (Title Case) on `/test-runs/:id/execute`
- [x] Selected test case priority Tag shows Title Case with correct severity color on `/test-runs/:id/execute`
- [x] No raw lowercase status or priority strings visible on either page
- [x] Save button on execution page uses primary color (not secondary gray)
- [x] All quality checks pass (lint, test, build)
