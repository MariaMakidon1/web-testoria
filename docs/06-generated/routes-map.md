# ROUTES MAP
# Generated from: src/router/index.ts
# Update this file whenever routes are added, removed, or renamed.

---

## Route table

| Name | Path | Component | Auth required |
|------|------|-----------|---------------|
| Login | `/login` | `views/auth/LoginView.vue` | No |
| ForgotPassword | `/forgot-password` | `views/auth/ForgotPasswordView.vue` | No |
| ResetPassword | `/reset-password` | `views/auth/ResetPasswordView.vue` | No |
| SetPassword | `/set-password` | `views/auth/ResetPasswordView.vue` | No |
| Dashboard | `/` | `views/dashboard/DashboardView.vue` | Yes |
| Projects | `/projects` | `views/projects/ProjectListView.vue` | Yes |
| ProjectDetail | `/projects/:id` | `views/projects/ProjectDetailView.vue` | Yes |
| TestCasesIndex | `/test-cases` | `views/test-cases/TestCasesIndexView.vue` | Yes |
| TestCases | `/projects/:projectId/test-cases` | `views/test-cases/TestCaseListView.vue` | Yes |
| TestCaseDetail | `/test-cases/:id` | `views/test-cases/TestCaseDetailView.vue` | Yes |
| TestCaseEdit | `/test-cases/:id/edit` | `views/test-cases/TestCaseEditorView.vue` | Yes |
| TestRuns | `/test-runs` | `views/test-runs/TestRunListView.vue` | Yes |
| TestRunDetail | `/test-runs/:id` | `views/test-runs/TestRunDetailView.vue` | Yes |
| TestRunExecution | `/test-runs/:id/execute` | `views/test-runs/TestRunExecutionView.vue` | Yes |
| TestRunCreate | `/test-runs/create` | `views/test-runs/TestRunCreateView.vue` | Yes |
| Reports | `/reports` | `views/reports/ReportDashboardView.vue` | Yes |
| Users | `/users` | `views/users/UserListView.vue` | Yes |
| UserDetail | `/users/:id` | `views/users/UserDetailView.vue` | Yes |
| Profile | `/profile` | `views/profile/ProfileView.vue` | Yes |
| Settings | `/settings` | `views/settings/SettingsView.vue` | Yes |
| AccessDenied | `/access-denied` | `views/AccessDeniedView.vue` | Yes |
| NotFound | `/:pathMatch(.*)*` | `views/NotFoundView.vue` | No |

---

## Navigation guard behavior

- Any route with `requiresAuth: true` redirects to `/login?redirect=<original-path>` if not authenticated.
- Navigating to `/login` while authenticated redirects to `/`.
- On any authenticated route, if `isAuthenticated=true` but `user=null`, the guard fetches the current user. If that fails, it logs out and redirects to `/login`.

---

## Layout

- The auth routes (`/login`, `/forgot-password`, `/reset-password`, `/set-password`) use the auth layout (no sidebar/header — the views are self-contained, full-screen).
- All other routes render inside `<DefaultLayout>` (sidebar + header).

---

## Notes

- All authenticated route components use lazy imports (`() => import(...)`).
- Route names are used for programmatic navigation: `router.push({ name: 'TestCaseDetail', params: { id } })`.
- The `TestRunCreate` route at `/test-runs/create` must appear before `/test-runs/:id` in the array to avoid `create` being matched as an `:id` param. This ordering is maintained in `src/router/index.ts`.
- `ResetPassword` (`/reset-password`) and `SetPassword` (`/set-password`) share `ResetPasswordView.vue`; the route name drives the copy (reset vs. welcome-invite). Both read the reset/invite token from the `?token=` query param. These paths are the contract with api-testoria plan 048's email links — renaming requires updating `FRONTEND_BASE_URL` link building there.
