# Feature: Password recovery & set-password (invite)

Public, pre-authentication screens that let a user recover a forgotten password
and let a newly-invited user set their first password. Companion to api-testoria
plan 048 (Gmail SMTP email + the recovery endpoints). Implemented in web plan 097.

---

## Flows

### Forgot password (`/forgot-password`)
- Reached via the **"Forgot password?"** link on `LoginView.vue`.
- Single email field → submits to `POST /auth/forgot-password`.
- Always shows the **same** "if an account exists, we've sent a link" confirmation, whether or not the email matches a user (mirrors the backend's no-enumeration `202`). A genuine network failure is swallowed into the same confirmation — the request is silently retriable.

### Set / reset password (`/reset-password` and `/set-password`)
- **One component** (`ResetPasswordView.vue`) serves both routes; the route name drives the copy:
  - `/reset-password` → "Reset your password" (forgot-password flow).
  - `/set-password` → "Set your password" welcome copy (welcome-invite flow).
- Reads the token from the `?token=` query param.
- **Validates the token on mount** via `GET /auth/reset-password/validate?token=...` before showing the form. Three render states:
  - *validating* — spinner.
  - *valid* — new-password + confirm fields, submit disabled until both filled.
  - *invalid* — "this link is no longer valid" with a **Request a new link** action (→ `/forgot-password`) and a back-to-sign-in link. Shown for a missing token, a `400`, or an unreachable endpoint.
- On submit: client checks (min length, confirm match) → `POST /auth/reset-password` → success toast → redirect to `/login`. If the token died between validation and submit, the server error is surfaced and the view drops to the invalid state so the user requests a fresh link rather than retrying a dead token.

### Welcome invite (account creation without a password)
- Admin **Create User** (`UserListView.vue`) no longer requires a password. When blank, `password` is omitted from the `UserCreate` payload; the backend creates the account with an unusable password and emails a welcome invite linking to `/set-password?token=...`.

---

## Password rules

- Client minimum: **8 characters**, plus a confirm-match check (`MIN_PASSWORD_LENGTH` in `ResetPasswordView.vue`).
- The backend currently only enforces a non-empty password, so the client rule is intentionally **stricter** — a value passing client checks never bounces back as a `422`. The server `error` (surfaced through the store) remains the source of truth if the backend tightens its policy.

---

## No-enumeration

The forgot-password confirmation is identical for existing and non-existing
emails. Token errors (invalid/expired/used) return a generic invalid-link state.
The token is single-use with a short TTL on the backend and is never rendered
into any on-page link.

---

## Architecture

| Layer | File |
|-------|------|
| Types | `src/types/auth.ts` — `ForgotPasswordRequest`, `ResetPasswordRequest`, `ResetTokenValidateResponse` |
| API | `src/api/auth.ts` — `forgotPassword`, `resetPassword`, `validateResetToken` |
| Store | `src/stores/auth.ts` — `forgotPassword`, `resetPassword`, `validateResetToken` actions (`loading` / `error` state) |
| Views | `src/views/auth/ForgotPasswordView.vue`, `src/views/auth/ResetPasswordView.vue` |
| Login link | `src/views/auth/LoginView.vue` ("Forgot password?") |
| Create-user | `src/components/users/UserForm.vue`, `src/views/users/UserListView.vue` (optional password) |
| Routes | `src/router/index.ts` — `/forgot-password`, `/reset-password`, `/set-password` (all `requiresAuth: false`, `layout: "auth"`) |

Recovery logic lives in `stores/auth` so the component → store → api invariant
holds even on these pre-auth screens; the views bind to `authStore.loading` and
`authStore.error`.

---

## Backend endpoints (api-testoria plan 048)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/forgot-password` | `{ email }` → `202` always (no enumeration); queues a reset email if a user matches |
| POST | `/auth/reset-password` | `{ token, new_password }` → `200`; `400` for invalid/expired/used token. Serves both reset and welcome set-password |
| GET | `/auth/reset-password/validate?token=...` | `200 { valid, username }` or `400`; peeks without consuming |

> **Route paths are the contract.** `/set-password` and `/reset-password` plus the `?token=` query param are exactly what plan 048 builds its email links to via `FRONTEND_BASE_URL`. Renaming requires updating both plans.

---

## Tests

- Unit (store): `tests/unit/stores/auth.spec.ts` — `forgotPassword` / `resetPassword` (snake_case `new_password`) / `validateResetToken` success + error paths.
- Component: `tests/unit/components/ResetPasswordView.spec.ts` — no-token, invalid-token, and valid-token render paths; welcome-heading variant on `/set-password`.
- E2E: `tests/e2e/password-recovery.spec.ts` — link navigation, no-enumeration confirmation, invalid-link states. The two backend-dependent happy paths (forgot → reset → login; set-password from a real invite token) are `test.fixme` pending api-testoria plan 048.
