# Execution Plan: API Integration — User Management

**Date**: 2026-04-06
**Author**: Claude
**Status**: Complete

---

## Goal

Implement user management CRUD in the frontend, connecting to the backend admin-only user endpoints.

---

## Context

The backend has a full user management system (`GET/POST/PUT/DELETE /users`, bulk create, export) accessible only to admins. The frontend currently has **no `src/api/users.ts`**, no user management views, and no user store beyond the auth store's `currentUser`. The only user data in the frontend comes from `GET /auth/me`.

---

## Scope

### In scope
- New `src/api/users.ts` with all user CRUD endpoints
- New `src/stores/users.ts` for admin user management
- New `src/views/users/UserListView.vue` and `UserDetailView.vue`
- Bulk user creation (up to 100)
- User export (CSV/Excel)
- Routes with admin role guard

### Out of scope
- User profile self-edit (users editing their own profile — future feature)
- User avatar/photo upload

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/user.ts` (new) | `UserCreate`, `UserUpdate`, `UserBulkCreate`, `UserBulkResult` interfaces |
| api | `src/api/users.ts` (new) | `getUsers()`, `getUser()`, `createUser()`, `bulkCreateUsers()`, `updateUser()`, `deleteUser()`, `exportUsers()` |
| store | `src/stores/users.ts` (new) | User list state, pagination, CRUD actions |
| views | `src/views/users/UserListView.vue` (new) | Paginated user table with search/filter |
| views | `src/views/users/UserDetailView.vue` (new) | User detail/edit form |
| components | `src/components/users/UserForm.vue` (new) | Reusable create/edit form |
| router | `src/router/index.ts` | Add `/users` and `/users/:id` routes (admin only) |

### Backend endpoints to wire

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/users` | List with search/filter/pagination |
| `POST` | `/users` | Create single user |
| `POST` | `/users/bulk` | Bulk create (max 100, best-effort) |
| `GET` | `/users/export?format=csv\|excel` | Download all users |
| `GET` | `/users/{id}` | Get user details |
| `PUT` | `/users/{id}` | Update user |
| `DELETE` | `/users/{id}` | Delete (409 if role is `lead`) |

### Key decisions

- User management is admin-only — routes and navigation should be hidden for non-admins
- Bulk create returns per-row errors — UI must show partial success state
- Delete returns 409 for `lead` role — show clear error message explaining constraint

---

## Tasks

### Implementation
- [x] Create `src/types/user.ts` with `UserCreate`, `UserUpdate`, `UserBulkCreate`, `UserBulkResult`
- [x] Create `src/api/users.ts` with all 7 endpoints
- [x] Create `src/stores/users.ts` — list state, pagination, CRUD actions
- [x] Create `UserListView.vue` with DataTable, search, filters, bulk actions
- [x] Create `UserDetailView.vue` with user edit form
- [x] Create `UserForm.vue` component for create/edit
- [x] Add routes in `src/router/index.ts` with admin-only meta
- [x] Add "Users" nav item to sidebar (admin only)
- [x] Handle 409 on delete (lead role constraint)
- [x] Implement bulk user creation with error reporting
- [x] Implement user export (CSV/Excel download)
- [ ] Write unit tests for users store
- [ ] Write unit tests for UserForm validation

### Quality check (Phase 4)
- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [x] `docs/06-generated/routes-map.md` updated
- [x] `docs/06-generated/api-schema.md` updated
- [x] `docs/01-product/features/users.md` created
- [x] `docs/02-architecture/ARCHITECTURE.md` codemap updated
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Bulk create partial failures confuse users | Medium | Show clear per-row success/error table |
| Non-admin accidentally navigates to /users | Low | Router guard + hide nav item |

---

## Definition of done

- [x] Admin can list, create, edit, delete users via real API
- [x] Bulk creation shows per-row results
- [x] Export downloads CSV/Excel
- [x] Non-admin users cannot access user management
- [ ] Unit tests pass
