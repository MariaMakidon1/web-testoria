# Execution Plan: 001 — Project Management

**Date**: 2026-03-23
**Author**: Claude
**Status**: Draft

---

## Goal

Harden project management: expose the full `ProjectStats` shape in the UI, display `description` on the detail view, and add guard logic that prevents creating runs or suites inside archived projects.

---

## Context

The feature is functionally complete. Analysis revealed that `ProjectStats.total_test_suites` is not surfaced anywhere in the UI (only test cases and runs are shown), the project `description` field is nullable but is never displayed on `ProjectDetailView`, and the archived-project guard is documented but not explicitly enforced on the frontend (the backend blocks it, but the UI shows no feedback before the API call fails).

---

## Scope

### In scope
- Display `description` in `ProjectDetailView` (when not null)
- Add `total_test_suites` to the project stats card alongside existing counts
- Show an inline warning/disabled state on "New Test Run" and "New Suite" buttons when `project.is_archived === true`
- Unit tests for `projectsStore` stat fetching and archived guard

### Out of scope
- Project-level permissions UI (handled by auth store flags, not this feature)
- Project member management (future feature)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| views | `src/views/ProjectDetailView.vue` | Render `project.description`; add `total_test_suites` to stats display |
| views | `src/views/ProjectDetailView.vue` | Disable / warn "New Test Run" and "New Suite" when `is_archived` |
| components | `src/components/common/StatusBadge.vue` | Confirm archived badge is rendered for `is_archived: true` |
| tests | `tests/unit/stores/projects.spec.ts` | New — stat fetch, archived flag, CRUD |

### Key decisions

- Archived guard is UI-only (disabled button + tooltip) — the backend remains the authoritative check. This avoids race conditions if a project is archived by another user mid-session.

---

## Tasks

### Implementation
- [x] Add `description` display to `ProjectDetailView` (already present)
- [x] Add `total_test_suites` to stats card (already present)
- [x] Disable action buttons and show tooltip when `is_archived === true`
- [x] Write unit tests for `projectsStore`

### Quality check
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update
- [ ] `docs/01-product/features/001-project-management.md` updated if behaviour changes
- [ ] This plan moved to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `description` is null for many existing projects — empty state must be handled | High | Only render the field when `description` is not null; no placeholder text |

---

## Definition of done

- [ ] `ProjectDetailView` shows description when present
- [ ] Stats card shows suite count
- [ ] Archived projects disable New Run and New Suite with visible feedback
- [ ] Unit tests passing
