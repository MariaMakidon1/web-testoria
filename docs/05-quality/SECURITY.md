# Security

Security considerations and controls in the Testoria frontend.

---

## Authentication

- JWT-based: `access_token` (short-lived) + `refresh_token` (long-lived)
- Tokens stored in `localStorage` — accessible to JavaScript. This is a known trade-off (XSS risk vs. cookie CSRF risk). HTTPOnly cookies would be more secure but require backend coordination.
- `access_token` auto-refreshed on 401 via `api/client.ts` interceptor — transparent to the user
- On refresh failure: tokens cleared, hard redirect to `/login`
- All authenticated routes protected by navigation guard in `src/router/index.ts`

## Authorization (frontend)

- Role flags (`isAdmin`, `isProjectManager`, `canManageTests`) derived from `user.role` in `stores/auth`
- Components read flags, never `user.role` directly — centralizes role logic
- **Important**: frontend role checks are UX-only. The backend enforces actual authorization. Never rely on frontend role checks as a security control.

## XSS

- Rich text fields (description, preconditions, comments) store HTML from Tiptap editor
- HTML is rendered with `v-html` — ensure content comes from trusted sources (own users, not external)
- Tiptap sanitizes output to a limited allowed tag set by default
- User input in non-rich-text fields is bound via `v-model` to Vue reactive state — Vue escapes interpolated values in templates by default

## Content Security

- The host nginx vhost (`deploy/web.vhost.conf`) should include a `Content-Security-Policy` header
- `X-Frame-Options` and `X-Content-Type-Options: nosniff` are set in `deploy/web.vhost.conf` (currently `X-Frame-Options: SAMEORIGIN`)

## Token exposure

- Do not log tokens to console
- Do not include tokens in URL parameters or error messages
- `api/client.ts` reads tokens from localStorage on every request — ensure no third-party scripts can access localStorage (CSP script-src)

## Dependencies

- Run `npm audit` regularly
- Keep PrimeVue, Axios, Tiptap, and other core dependencies updated
- Use `npm audit fix` for non-breaking fixes; review breaking fixes manually

## Sensitive data

- No passwords are ever stored in frontend state or localStorage
- User PII (email, full_name) is in `stores/auth.user` in memory only — cleared on logout

## HTTPS

- Host nginx enforces the HTTPS redirect and HSTS (see `deploy/web.vhost.conf`; api/s3 in `api-testoria/deploy/api.vhost.conf`)
- Never deploy to HTTP in production
