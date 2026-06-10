# Execution Plan: Invite-only user creation, opened to Lead + Admin (web)

**Date**: 2026-06-03
**Author**: gabriel.arapan
**Status**: In Progress — code + unit tests + docs landed; `lint`/`build`/`test` green. Pending: end-to-end verification against the real backend (api 049) + PR review. Pairs with api plan 049.

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.
>
> **Pointer plan.** This is the web-side companion to the authoritative cross-repo plan:
> `api-testoria/docs/04-execution/exec-plans/active/049-be-invite-only-user-creation-and-lead-management.md`
> Read that file first — it holds the contract, the role-ceiling rule, and the rationale.
> Backend ships first; this plan adapts the UI to the new contract.

---

## Goal

Let **Lead** (not just Admin) reach user management, remove the password input so every new user is
onboarded via the email set-password invite, and prevent a Lead from creating or touching Admins in
the UI — mirroring the backend's role ceiling.

---

## Context

Today the frontend treats user management as Admin-only and still collects a password:

- The `/users` and `/users/:id` routes are gated `minRole: "admin"` (`src/router/index.ts`), and UI
  affordances key off `authStore.isAdmin` (exact-match admin). A Lead sees nothing.
- `UserForm.vue` still has a password field; `UserListView.vue`'s **Bulk Create** still parses a
  `username,email,password,full_name,role` CSV and rejects empty-password rows — both tracked as open
  items in `docs/04-execution/tech-debt.md` (plan-097 follow-ups). Single-user create already treats
  password as optional, but the field is still present.

Backend plan 049 removes `password` from `UserCreate`, opens `/users*` to Lead+Admin, deletes public
`POST /auth/register`, and enforces a **Lead-capped-at-Lead** rule (a Lead cannot create, elevate to,
modify, or delete an Admin). This plan brings the UI in line.

The auth store already exposes the needed hierarchy helper: `isProjectManager = hasMinRole("lead")`
(`src/stores/auth.ts`). There is **no public signup screen** to remove (auth routes are login / forgot
/ reset / set-password only), so the register-endpoint removal needs no UI change beyond confirming
nothing calls it.

---

## Scope

### In scope
- Open the user-management routes and UI to Lead+Admin.
- Add a `canManageUsers` auth flag and use it where `isAdmin` currently gates user management.
- Remove the password field from the create flow (`UserForm.vue`) and the password column from the
  Bulk Create CSV (`UserListView.vue`) + format hint.
- Client-side role ceiling: hide the **Admin** option in the role picker and hide edit/delete on
  Admin rows when the current user is a Lead (defence-in-depth; backend is the real gate).
- Drop `password` from the `UserCreate` type and the create payloads.
- Tests + docs.

### Out of scope
- Edit-mode password handling (backend keeps `UserUpdate.password`; see plan 049 out-of-scope).
- Proper quoted-CSV parsing for bulk create (separate tech-debt item).
- Forgot-password resend/rate-limit UX (separate tech-debt item).

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| router | `src/router/index.ts` | `/users` and `/users/:id`: `minRole: "admin"` → `minRole: "lead"`. |
| store | `src/stores/auth.ts` | Add `canManageUsers = computed(() => hasMinRole("lead"))`; export it. |
| types | `src/types/user.ts` | Remove `password` from `UserCreate`. |
| api / store | `src/api/users.ts`, `src/stores/users.ts` | Drop `password` from create/bulk payload construction. |
| components | `src/components/users/UserForm.vue` | Remove the password field/validation from create; in the role dropdown, omit `admin` when `!authStore.isAdmin`. |
| views | `src/views/users/UserListView.vue` | Bulk CSV → `username,email,full_name,role`; update placeholder/hint; gate row edit/delete on Admin targets by `authStore.isAdmin`. Gate the page's "Create user" / management actions on `canManageUsers`. |
| views | `src/views/users/UserDetailView.vue` | Gate edit/delete of an Admin user by `authStore.isAdmin`. |

### Key decisions

- **Reuse the role hierarchy, don't hardcode two roles.** A `canManageUsers = hasMinRole("lead")`
  flag matches the architectural invariant (role checks via `stores/auth` flags, never `user.role`
  directly) and naturally covers Lead+Admin and any future higher role.
- **Client guards are UX, not security.** Hiding the Admin option and Admin-row actions for Leads
  mirrors the backend ceiling so users don't hit surprise 403s — but the backend (plan 049) remains
  the authority. Keep store actions resilient to a 403 (surface the error toast).
- **Remove password by type, not by hiding.** Dropping it from the `UserCreate` type forces every
  call site to stop sending it, and makes the bulk path consistent automatically.

---

## Tasks

### Implementation
- [ ] `src/router/index.ts`: lower both `/users*` routes to `minRole: "lead"`.
- [ ] `src/stores/auth.ts`: add + export `canManageUsers`.
- [ ] `src/types/user.ts`: remove `password` from `UserCreate`.
- [ ] `src/api/users.ts` + `src/stores/users.ts`: stop sending `password` on create/bulk.
- [ ] `src/components/users/UserForm.vue`: remove the password field; filter `admin` out of the
      role options when `!isAdmin`.
- [ ] `src/views/users/UserListView.vue`: new bulk CSV format + hint; gate management actions on
      `canManageUsers` and Admin-target actions on `isAdmin`.
- [ ] `src/views/users/UserDetailView.vue`: gate Admin-target edit/delete on `isAdmin`.
- [ ] Unit tests: `canManageUsers` flag; `UserForm` role-option filtering; bulk CSV parse without password.
- [ ] E2e (if a critical flow): Lead can open `/users` and invite a non-admin user.

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/06-generated/routes-map.md` — `/users*` minRole now `lead`.
- [ ] `docs/06-generated/api-schema.md` — `createUser`/bulk no longer send `password`.
- [ ] `docs/01-product/features/users.md` — invite-only, Lead+Admin, Lead can't manage Admins.
- [ ] `docs/02-architecture/ARCHITECTURE.md` — note `canManageUsers` flag in the auth-store row.
- [ ] `docs/08-decisions/changelog.md` — record the decision.
- [ ] `docs/04-execution/tech-debt.md` — resolve "Bulk Create still requires a per-row password
      (plan-097)"; note the proper-CSV-parsing item remains.
- [ ] `docs/05-quality/QUALITY_SCORE.md` — update if metrics change.
- [ ] Keep in sync with api plan 049; move both to `completed/` together once verified.
- [ ] This plan moved from `active/` to `completed/`.
- [ ] PR review and merge.

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Web ships before api 049 (password still required server-side / 403 for Lead) | Medium | Sequence after backend deploy; the cross-repo pair moves to `completed/` together. |
| Lead hits a 403 on an Admin action the UI didn't hide | Low | Backend is the gate; ensure store surfaces 403 as a toast rather than a silent failure. |
| Stale `isAdmin` checks left elsewhere gating user mgmt | Medium | Grep for `isAdmin` across `views/users` + nav/menu; convert user-mgmt gates to `canManageUsers`, keep Admin-only gates (e.g. Admin-target actions) on `isAdmin`. |

---

## Definition of done

- [ ] A Lead can open `/users`, invite a user (no password field), and that user receives the
      set-password email; the Admin role option is not offered to a Lead.
- [ ] Bulk Create accepts `username,email,full_name,role` (no password column).
- [ ] Admin-target edit/delete hidden for Leads; backend 403 surfaced gracefully if reached.
- [ ] Unit tests written and passing; `npm run build` clean.
- [ ] Docs updated; verified together with api plan 049 before both move to `completed/`.
