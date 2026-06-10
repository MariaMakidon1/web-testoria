# Execution Plan: API Integration — Auth & Roles

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Replace mock auth data with real backend endpoints and align role definitions between frontend and backend.

---

## Context

The frontend auth layer (`src/api/auth.ts`) already has real API calls behind the `MOCK_ENABLED` guard. However, the **role definitions are mismatched** between frontend and backend, which will cause authorization failures when connecting to the real API.

- **Frontend roles**: `admin | project_manager | tester | viewer`
- **Backend roles**: `no_access | read_only | tester | lead | admin`

The login endpoint sends `application/x-www-form-urlencoded` (correct for FastAPI OAuth2). Token refresh and logout are already wired. Registration endpoint (`POST /auth/register`) is missing from the frontend entirely.

---

## Scope

### In scope
- Align `UserRole` type with backend values
- Update all role-derived permission flags in `stores/auth` to match backend roles
- Update role display labels/colors throughout components
- Add `POST /auth/register` endpoint + mock
- Verify token refresh flow works with real backend (401 → refresh → retry)
- Add `GET /roles` endpoint (list predefined roles)

### Out of scope
- User management CRUD (covered in plan-018)
- WebSocket token endpoints (covered in plan-025)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/auth.ts` | `UserRole` → `'no_access' \| 'read_only' \| 'tester' \| 'lead' \| 'admin'`; add `RegisterRequest`, `Role` interfaces |
| api | `src/api/auth.ts` | Add `register()`, `getRoles()` functions |
| mock | `src/mock/api/auth.mock.ts` | Add `mockRegister()`, `mockGetRoles()` |
| mock | `src/mock/data/users.ts` | Update user roles to backend values |
| store | `src/stores/auth.ts` | Update permission flags: `isAdmin` → `role === 'admin'`, `isProjectManager` → `role === 'lead'`, `canManageTests` → `role >= 'tester'` level check |
| components | All components using role checks | Update role string references if any bypass store flags |
| views | Registration view (if exists) | Wire to `register()` API |

### Key decisions

- **Role mapping**: `project_manager` → `lead`, `viewer` → `read_only`. The `no_access` role has no frontend equivalent today — treat as logged-out/blocked.
- **Case convention**: Backend uses lowercase (`admin`), frontend currently uses lowercase too — no case transformation needed.
- **Role level check**: Use numeric levels (`no_access=0, read_only=1, tester=2, lead=3, admin=4`) for "at least X" permission checks rather than enumerating roles.

---

## Tasks

### Implementation
- [x] Update `UserRole` type in `src/types/auth.ts` to match backend: `'no_access' | 'read_only' | 'tester' | 'lead' | 'admin'`
- [x] Add `ROLE_LEVELS` constant map for level-based permission checks
- [x] Add `RegisterRequest` interface and `Role` interface to types
- [x] Add `register()` and `getRoles()` to `src/api/auth.ts`
- [x] Add `mockRegister()` and `mockGetRoles()` to `src/mock/api/auth.mock.ts`
- [x] Update `src/mock/data/users.ts` — change role values to backend names
- [x] Update `src/stores/auth.ts` — rewrite permission computed props using `ROLE_LEVELS`
- [x] Search all components for hardcoded role strings and update
- [x] Verify login → token storage → authenticated requests → refresh flow against real backend
- [x] Write unit tests for auth store permission logic with new roles

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [x] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/06-generated/api-schema.md` updated
- [x] `docs/01-product/features/auth.md` updated
- [x] `docs/02-architecture/frontend/api-layer.md` updated if auth patterns changed
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Role rename breaks existing component role checks | Medium | Grep for all old role strings before changing types |
| Token format mismatch (JWT payload fields) | Low | Verify `TokenPayload` interface matches backend JWT claims |
| Registration disabled on backend (`REGISTRATION_OPEN=false`) | Low | Handle 403/404 gracefully, disable register button |

---

## Definition of done

- [x] `UserRole` type matches backend exactly
- [x] All permission checks in `stores/auth` use backend role names
- [x] Login/logout/refresh work against real backend
- [x] Registration endpoint wired (with graceful handling when disabled)
- [x] No hardcoded old role strings remain in codebase
- [x] Unit tests pass for all role permission levels
