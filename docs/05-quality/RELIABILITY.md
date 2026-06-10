# Reliability

How Testoria handles failures and what makes the frontend resilient.

---

## Error handling strategy

**API errors** bubble from `api/<domain>.ts` → store → component:
1. Store catches errors in `try/catch`, sets `store.error` as a string
2. Component displays `store.error` (inline message or toast)
3. User can retry by triggering the action again

**Critical failure** (e.g., auth token expired): `api/client.ts` interceptor clears tokens and redirects to `/login`. This is a hard browser redirect, not `router.push`, so state is fully reset.

**Logout errors**: silently ignored. `stores/auth.logout()` always calls `clearAuth()` in `finally` — the user is always logged out even if the API call fails.

---

## Loading states

Every async store action has a `loading` ref:
- Set to `true` before the async call
- Cleared in `finally` (not in `then` — runs even on error)

Components bind `loading` to show skeleton/spinner during fetches and disable submit buttons during form submission.

---

## Token refresh reliability

The token refresh is automatic and transparent:
- On 401: one refresh attempt is made (guarded by `_retry` flag to prevent loops)
- If refresh succeeds: original request is retried with the new token
- If refresh fails: hard redirect to login

Edge case: if multiple requests fail with 401 simultaneously, each will attempt a refresh. This can result in multiple refresh calls. The backend should handle this gracefully (idempotent refresh). Frontend-side deduplication is not currently implemented.

---

## Data consistency

- Stores hold the last-fetched data. After a mutation (create/update/delete), the store should refresh the affected list or update the item in place.
- No optimistic updates currently — all mutations wait for API confirmation before updating state.
- If an API call fails, store state is unchanged (no partial updates).

---

## Offline mode

There is no offline mode. The app requires network access to function. All API calls go directly to the backend.

---

## SPA routing

Production nginx serves `index.html` for all paths (SPA fallback). If a user bookmarks `/test-cases/123` and navigates directly, the app loads, the navigation guard runs, and either fetches the resource or redirects to login.

404 for unknown routes: currently no 404 view — Vue Router falls through to no match. A catch-all route (`{ path: '/:pathMatch(.*)*', name: '404', component: ... }`) should be added.
