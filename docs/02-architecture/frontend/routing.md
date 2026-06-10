# Routing

Vue Router 5 setup, navigation guard, and route conventions.

---

## Route definitions

All routes are in `src/router/index.ts`. See `docs/06-generated/routes-map.md` for the full table.

Key points:
- All routes use **lazy imports**: `component: () => import('@/views/...')`
- All authenticated routes carry `meta: { requiresAuth: true }`
- The auth routes — `/login`, `/forgot-password`, `/reset-password`, `/set-password` — carry `meta: { requiresAuth: false, layout: 'auth' }`. `/reset-password` and `/set-password` share `ResetPasswordView.vue` (plan-097)
- History mode: `createWebHistory()` (clean URLs, server must serve `index.html` for all paths)

---

## Navigation guard

```
router.beforeEach(async (to, _from) => {
  const authStore = useAuthStore()

  // 1. Unauthenticated access to protected route → redirect to login with redirect param
  if (to.meta.requiresAuth && !authStore.isAuthenticated)
    return { name: 'Login', query: { redirect: to.fullPath } }

  // 2. Already logged in, trying to reach /login → redirect to dashboard
  if (to.name === 'Login' && authStore.isAuthenticated)
    return { name: 'Dashboard' }

  // 3. Authenticated but user object not loaded (e.g., page refresh) → fetch user
  if (authStore.isAuthenticated && !authStore.user) {
    try { await authStore.fetchCurrentUser() }
    catch { authStore.logout(); return { name: 'Login' } }
  }
})
```

The guard handles the common "refresh the page while logged in" scenario: tokens are in localStorage, so `isAuthenticated` is true, but the user object is gone. The guard fetches it before rendering.

---

## Programmatic navigation

Use route names, not paths:

```ts
import { useRouter } from 'vue-router'
const router = useRouter()

// Good
router.push({ name: 'TestCaseDetail', params: { id: testCase.id } })
router.push({ name: 'TestCases', params: { projectId: project.id } })

// Bad — hardcoded paths break on rename
router.push(`/test-cases/${testCase.id}`)
```

---

## Layout selection

- Routes with `meta: { layout: 'auth' }` render without the sidebar/header.
- All other routes render inside `<DefaultLayout>` (sidebar + header). The layout check is in `App.vue` or `DefaultLayout.vue`.

---

## Adding a new route

1. Add the route object to the `routes` array in `src/router/index.ts`
2. Use a lazy import for the component
3. Add `meta: { requiresAuth: true }` (unless it is a public page)
4. Name the route in PascalCase matching the view component name (without `View` suffix is fine)
5. Update `docs/06-generated/routes-map.md`

---

## Route naming conventions

| Pattern | Example |
|---------|---------|
| List view | `TestRuns` |
| Detail view | `TestRunDetail` |
| Create view | `TestRunCreate` |
| Edit view | `TestCaseEdit` |
| Execution / special | `TestRunExecution` |
| Index (cross-project) | `TestCasesIndex` |

---

## Notes on ordering

`/test-runs/create` must appear before `/test-runs/:id` in the routes array. Vue Router matches in order — if `:id` comes first, the string `"create"` would be matched as an id param.

---

## Project switcher redirects (plan-056)

When the header project switcher changes `projectsStore.selectedProjectId`, an app-level watcher installed by `useProjectSwitchRedirect` (called once in `DefaultLayout.vue`) replaces the URL for routes whose identity is tied to the old project:

| Current route name | Target |
|---|---|
| `TestRunDetail`, `TestRunExecution`, `TestRunCreate` | `{ name: "TestRuns" }` |
| `TestCaseDetail`, `TestCaseEdit` | `{ name: "TestCases", params: { projectId: <new> } }` |
| `TestCases` (already project-scoped) | Same route, new `projectId` |
| Any other route | No redirect — list pages re-query via their own watcher on `selectedProjectId` |

The watcher is not `immediate`, so deep-linking into `/test-runs/5` on page load does not trigger a redirect. It uses `router.replace` so back-navigation does not rewind through the stale URL. When a view's `beforeRouteLeave` aborts the navigation, the watcher reverts `selectedProjectId` to its previous value.

When adding a route whose identity is scoped to a project, add an entry to `redirectTargetForSwitch` in `src/composables/useProjectSwitchRedirect.ts`.
