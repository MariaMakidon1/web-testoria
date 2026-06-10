# Execution Plan: API Integration — Test Results, History & Attachments

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Align test result types with backend and verify result submission, history, and attachment endpoints work against the real API.

---

## Tasks

### Implementation
- [x] Update `ResultStatus` → `'passed' | 'failed' | 'blocked' | 'skipped'` (lowercase, 4 values)
- [x] Remove `'Retest'` and `'Untested'` — "untested" computed from absence of result
- [x] Update `RESULT_STATUS_COLORS`, `RESULT_STATUS_ICONS` — lowercase keys, 4 entries
- [x] Added `RESULT_STATUS_LABELS` display map
- [x] Simplified `TestResultTestCase` — removed `automation_id`, `references`, `labels`, `estimated_time`
- [x] Removed `AttachmentCreate` — attachments uploaded separately via file upload
- [x] Removed `data_url` from `Attachment` — use `file_path` directly
- [x] Removed `TestLabel` type
- [x] Updated `TestResultHistory` — removed `message`, `changed_by_name`
- [x] Updated store: `totalCasesInRun` ref for untested computation, `setTotalCases()` action
- [x] Updated StatusBadge result colors
- [x] Updated TestRunExecutionView — lowercase statuses, removed Retest shortcut
- [x] Updated TestRunDetailView — lowercase status keys
- [x] Updated TestResultsList — lowercase statuses, removed retest/untested counts
- [x] Updated TestResultCard — removed labels section
- [x] Updated TestResultDetail — removed labels, estimated_time, references, automation_id sections; fixed attachment image src
- [x] Updated TestResultHistoryPanel — removed message/changed_by_name
- [x] Updated DashboardView — 4 lowercase status values in chart
- [x] Updated useExcelExport/usePdfExport — lowercase statuses, "No Result" for missing
- [x] Updated preferences store — `defaultResultStatus: 'passed' | 'failed' | null`
- [x] Updated SettingsView — status dropdown options
- [x] Updated tests (testResults.spec.ts, StatusBadge.spec.ts)

### Quality check (Phase 4)
- [x] `npm run build` passes
- [x] `npm run test -- --run` passes (281/281)
- [x] `npm run lint` passes

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated
- [x] `docs/02-architecture/ARCHITECTURE.md` updated
- [x] This plan moved from `active/` to `completed/`

---

## Definition of done

- [x] Result statuses match backend exactly (4 values, lowercase)
- [x] "Untested" is computed from missing results, not a status
- [x] Attachments upload separately from result submission
- [x] History displays correctly from backend format
- [x] Unit tests pass
