# Execution Plan: Fix User Password Update — Frontend Type Alignment

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-041-fix-user-password-update-frontend.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Align the frontend `UserUpdate` TypeScript type with the backend schema to include the `password` field, and add a success confirmation specific to password changes.

---

## Context

The frontend correctly sends `password` in the `PUT /users/{id}` request body (`UserDetailView.vue` line 63-64), but the `UserUpdate` TypeScript interface in `types/user.ts` does not include `password`. This works at runtime because TypeScript types are erased, but it's a type safety gap — the `Record<string, unknown>` cast at line 57 bypasses the type system.

The backend fix (API Plan 022) adds `password` to the `UserUpdate` Pydantic schema. This frontend plan aligns the TypeScript type and improves the UX around password changes.

**Depends on**: API Plan 022 (backend `UserUpdate` schema fix).

---

## Scope

### In scope

- Add `password?: string` to `UserUpdate` interface in `types/user.ts`
- Refactor `UserDetailView.vue` `handleSave` to use the typed `UserUpdate` instead of `Record<string, unknown>`
- Show a distinct toast message when password was changed ("Password updated successfully")
- Prevent sending empty string as password (guard against `""`)

### Out of scope

- Password strength indicator (separate enhancement)
- Self-service password change (separate feature)
- Backend changes (covered by API Plan 022)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| types | `src/types/user.ts` | Add `password?: string` to `UserUpdate` interface |
| views | `src/views/users/UserDetailView.vue` | Use typed `UserUpdate` instead of `Record<string, unknown>`; add password-specific toast; guard empty string |

### Implementation

**1. `src/types/user.ts`:**

```ts
export interface UserUpdate {
  email?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;  // ADD
}
```

**2. `src/views/users/UserDetailView.vue` — refactor `handleSave`:**

```ts
async function handleSave() {
  try {
    const updateData: UserUpdate = {
      email: formData.value.email,
      full_name: formData.value.full_name || undefined,
      role: formData.value.role,
      is_active: formData.value.is_active,
    };
    const passwordChanged = formData.value.password.trim().length > 0;
    if (passwordChanged) {
      updateData.password = formData.value.password;
    }
    await usersStore.updateUser(userId, updateData);

    const detail = passwordChanged
      ? "User updated and password changed successfully"
      : "User updated successfully";
    toast.add({ severity: "success", summary: "Success", detail, life: 3000 });

    editing.value = false;
    formData.value.password = "";
  } catch (error) {
    // ... existing error handling
  }
}
```

---

## Tasks

### Implementation

- [x] Add `password?: string` to `UserUpdate` in `src/types/user.ts`
- [x] Refactor `handleSave` in `UserDetailView.vue` to use `UserUpdate` type (remove `Record<string, unknown>`)
- [x] Add `.trim()` guard to prevent sending empty/whitespace-only passwords
- [x] Add password-specific success toast message
- [x] Verify: update user with password → toast says "password changed" → can log in with new password
- [x] Verify: update user without password → toast says "user updated" → existing password unchanged

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)

- [x] `docs/06-generated/api-schema.md` — update `UserUpdate` to include `password` field
- [x] `docs/08-decisions/changelog.md` — note type alignment fix
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deploying frontend before API Plan 022 | Low | Frontend already sends `password` — behavior unchanged until backend accepts it |

---

## Definition of done

- [x] `UserUpdate` TypeScript type includes `password?: string`
- [x] `handleSave` uses typed `UserUpdate` (no `Record<string, unknown>` cast)
- [x] Empty/whitespace passwords are not sent to the backend
- [x] Toast message indicates when password was changed
- [x] All quality checks pass (lint, test, build)
