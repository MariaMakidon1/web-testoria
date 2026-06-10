# Execution Plan: 007 — Defect Tracking

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Improve defect linking UX: add URL auto-formatting per tracker type, validate required fields (`tracker`, `key`) before adding a defect, and add a visual indicator when a result has linked defects in the results list.

---

## Context

The defect tracking feature is functionally complete. Analysis identified UX gaps: (1) no URL is constructed automatically from `tracker` + `key` (e.g. entering `github` + `#42` could prefill a base URL if the project has a configured repo URL); (2) required field validation (`tracker` and `key`) is not enforced client-side before the defect is added to the list; (3) the results list does not show a defect count badge, so testers have no at-a-glance view of which results have open defects. Also noted: the `Defect` type has no `status` field — "open/closed" tracking was documented incorrectly and has been corrected.

---

## Scope

### In scope
- Client-side required-field validation for `tracker` and `key` in `DefectsPanel`
- Defect count badge on `TestResultCard` and in `TestResultsList`
- Optional: derive `url` from `tracker` + `key` when a project-level base URL is configured (out of scope for now — see below)

### Out of scope
- Project-level tracker URL configuration (requires new project settings UI — deferred)
- Syncing defect status from external trackers (no API integration planned)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/test-runs/DefectsPanel.vue` | Add form validation: `tracker` and `key` are required before adding |
| components | `src/components/test-runs/TestResultCard.vue` | Add defect count badge (shown when `defects.length > 0`) |
| components | `src/components/test-runs/TestResultsList.vue` | Show defect indicator column |

### Key decisions

- Defect count badge uses a PrimeVue `Badge` component with a warning colour — consistent with other status indicators in the app.
- Validation is synchronous (no API call) — errors shown inline next to the form fields using PrimeVue `small` error text.

---

## Tasks

### Implementation
- [ ] Add required-field validation to `DefectsPanel` add-defect form
- [ ] Add defect count badge to `TestResultCard`
- [ ] Add defect indicator to `TestResultsList`

### Quality check
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/007-defect-tracking.md` updated if behaviour changes
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Defects array is null for old results — badge must handle null safely | High | Use `(result.defects ?? []).length` throughout |

---

## Definition of done

- [ ] Cannot add a defect without `tracker` and `key` — form shows inline errors
- [ ] Results with defects show a count badge in the list
- [ ] All edge cases (null defects, zero defects) handled without errors
