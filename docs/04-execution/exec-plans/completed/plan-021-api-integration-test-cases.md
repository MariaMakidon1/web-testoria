# Execution Plan: API Integration — Test Cases & Tags

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Align test case and tag types with backend schema and verify all test case endpoints work against the real API.

---

## Tasks

### Implementation
- [x] Refactor `src/types/testCase.ts` — `Priority` → lowercase, `TestType` → `TestCaseType` (`manual|automated`), removed `AutomationStatus`, added `TestCaseStatus`, removed `estimated_time`/`created_by`, `Tag` removed `color`, added label maps
- [x] Update `src/api/testCases.ts` — fix `TestCaseFilters` (replaced `automation_status` with `status`)
- [x] Update `src/api/tags.ts` — changed to global endpoints (`/tags`)
- [x] Update `src/stores/tags.ts` — removed projectId parameter
- [x] Update `TestCaseEditorView` — new form fields, removed estimated time/automation/color picker
- [x] Update `TestCaseListView` — new filter dropdowns and create dialog
- [x] Update `TestCaseDetailView` — new display fields
- [x] Update `TestCaseSection` — replaced automation_status with status
- [x] Update `StatusBadge` — lowercase priority keys, replaced automation with type
- [x] Update `ReportDashboardView` — lowercase priority keys, `tc.type === 'automated'`
- [x] Update `TestRunExecutionView` — lowercase priority checks
- [x] Update `useExcelExport`/`usePdfExport` — replaced automation_status refs
- [x] Update unit tests (StatusBadge, testCases store)
- [x] Grep confirmed no old enum values remain

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes (282/282)
- [x] `npm run build` passes

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated (filters, tags section)
- [x] `docs/01-product/features/003-test-case-authoring.md` updated
- [x] `docs/02-architecture/ARCHITECTURE.md` — Key types section updated
- [x] This plan moved from `active/` to `completed/`

---

## Definition of done

- [x] All test case types match backend schema exactly
- [x] Tag operations work (global scope)
- [x] Filter panel uses correct enum values
- [x] No references to old enum values remain
- [x] Unit tests pass
