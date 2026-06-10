# Execution Plan: Add Eye Icon Toggle to All Password Fields

**Date**: 2026-04-08
**Author**: Claude
**Status**: Complete (2026-04-13)

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/plan-039-password-toggle-visibility.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

Add an eye icon to toggle password visibility on all password fields in the app.

---

## Context

The login page (`LoginView.vue`) already uses PrimeVue's `Password` component with `toggleMask`, which provides the eye icon to show/hide the password. However, the `UserForm.vue` component (used for both creating and editing users) uses a plain `InputText type="password"` (line 99) with no visibility toggle. Users have no way to verify what they typed when setting a password for a new user or changing an existing user's password.

---

## Scope

### In scope

- Replace `InputText type="password"` with PrimeVue `Password` component with `toggleMask` in `UserForm.vue`
- Disable the strength feedback panel (`:feedback="false"`) since this is an admin form, not a registration form

### Out of scope

- Password strength requirements (backend concern)
- Adding password fields to other pages (no other password fields exist)

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| components | `src/components/users/UserForm.vue` | Replace `InputText type="password"` with `Password toggleMask :feedback="false"`; update import |

### Implementation

In `UserForm.vue`, replace:

```vue
<script setup>
import InputText from "primevue/inputtext";
```

Add:
```vue
import Password from "primevue/password";
```

Replace the password field (lines 99-106):

**Current:**
```vue
<InputText
  id="user-password"
  :model-value="form.password"
  class="w-full"
  type="password"
  :disabled="disabled"
  @update:model-value="update('password', $event as string)"
/>
```

**Fix:**
```vue
<Password
  inputId="user-password"
  :model-value="form.password"
  :feedback="false"
  toggleMask
  :disabled="disabled"
  @update:model-value="update('password', $event as string)"
/>
```

Note: PrimeVue `Password` uses `inputId` instead of `id`, and doesn't need `type="password"` or `class="w-full"` (the component handles its own width via the wrapper). If the full-width styling doesn't apply automatically, add `:pt="{ root: { class: 'w-full' } }"` or wrap in a styled container.

### Key decisions

- **PrimeVue `Password` over custom toggle**: Consistent with LoginView. Same component, same behavior, same accessibility (aria labels, keyboard toggle).
- **`:feedback="false"`**: Disables the strength meter popup. This is an admin form — the admin doesn't need password strength hints when creating user accounts.
- **`toggleMask`**: Shows the eye icon that toggles between `type="password"` and `type="text"`.

---

## Tasks

### Implementation

- [x] Import `Password` from `primevue/password` in `UserForm.vue`
- [x] Replace `InputText type="password"` with `Password toggleMask :feedback="false"`
- [x] Verify the field renders full-width in the form layout
- [x] Verify eye icon toggles password visibility on Create User dialog
- [x] Verify eye icon toggles password visibility on Edit User page (UserDetailView)

### Quality check (Phase 4)

- [x] `npm run lint` passes
- [x] `npm run test -- --run` passes
- [x] `npm run build` passes

### Docs update (Phase 5)

- [x] `docs/08-decisions/changelog.md` — note password visibility toggle
- [x] This plan moved from `active/` to `completed/`

---

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PrimeVue Password component width doesn't match InputText | Low | Test in both dialogs; add width styling if needed |
| `update:model-value` event signature differs between Password and InputText | Low | Both emit string values; verify with a quick test |

---

## Definition of done

- [x] All password fields in the app have an eye icon to toggle visibility
- [x] Login page still works correctly (already uses Password component)
- [x] Create User dialog password field has eye icon toggle
- [x] Edit User page password field has eye icon toggle
- [x] All quality checks pass (lint, test, build)
