import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { useAuthStore } from "@/stores/auth";
import type { UserRole } from "@/types/auth";
import { ROLE_LEVELS } from "@/types/auth";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/auth/LoginView.vue"),
    meta: { layout: "auth", requiresAuth: false },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("@/views/auth/ForgotPasswordView.vue"),
    meta: { layout: "auth", requiresAuth: false },
  },
  {
    // Reset (forgot-password flow) and set-password (welcome invite) share one
    // view; the route name drives the copy. Both read the `?token=` query param.
    path: "/reset-password",
    name: "ResetPassword",
    component: () => import("@/views/auth/ResetPasswordView.vue"),
    meta: { layout: "auth", requiresAuth: false },
  },
  {
    path: "/set-password",
    name: "SetPassword",
    component: () => import("@/views/auth/ResetPasswordView.vue"),
    meta: { layout: "auth", requiresAuth: false },
  },
  {
    path: "/",
    name: "Dashboard",
    component: () => import("@/views/dashboard/DashboardView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/projects",
    name: "Projects",
    component: () => import("@/views/projects/ProjectListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/projects/:id",
    name: "ProjectDetail",
    component: () => import("@/views/projects/ProjectDetailView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/test-cases",
    name: "TestCasesIndex",
    component: () => import("@/views/test-cases/TestCasesIndexView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/projects/:projectId/test-cases",
    name: "TestCases",
    component: () => import("@/views/test-cases/TestCaseListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/test-cases/:id",
    name: "TestCaseDetail",
    component: () => import("@/views/test-cases/TestCaseDetailView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/test-cases/:id/edit",
    name: "TestCaseEdit",
    component: () => import("@/views/test-cases/TestCaseEditorView.vue"),
    meta: { requiresAuth: true, minRole: "lead" as UserRole },
  },
  {
    path: "/test-runs",
    name: "TestRuns",
    component: () => import("@/views/test-runs/TestRunListView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/test-runs/create",
    name: "TestRunCreate",
    component: () => import("@/views/test-runs/TestRunCreateView.vue"),
    meta: { requiresAuth: true, minRole: "tester" as UserRole },
  },
  {
    path: "/test-runs/:id",
    name: "TestRunDetail",
    component: () => import("@/views/test-runs/TestRunDetailView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/test-runs/:id/execute",
    name: "TestRunExecution",
    component: () => import("@/views/test-runs/TestRunExecutionView.vue"),
    meta: { requiresAuth: true, minRole: "tester" as UserRole },
  },
  {
    path: "/reports",
    name: "Reports",
    component: () => import("@/views/reports/ReportDashboardView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/users",
    name: "Users",
    component: () => import("@/views/users/UserListView.vue"),
    meta: { requiresAuth: true, minRole: "lead" as UserRole },
  },
  {
    path: "/users/:id",
    name: "UserDetail",
    component: () => import("@/views/users/UserDetailView.vue"),
    meta: { requiresAuth: true, minRole: "lead" as UserRole },
  },
  {
    path: "/profile",
    name: "Profile",
    component: () => import("@/views/profile/ProfileView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("@/views/settings/SettingsView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/access-denied",
    name: "AccessDenied",
    component: () => import("@/views/AccessDeniedView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation guard
router.beforeEach(async (to, _from) => {
  const authStore = useAuthStore();

  // Check if route requires auth
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: "Login", query: { redirect: to.fullPath } };
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (to.name === "Login" && authStore.isAuthenticated) {
    return { name: "Dashboard" };
  }

  // Fetch user if authenticated but user not loaded
  if (authStore.isAuthenticated && !authStore.user) {
    try {
      await authStore.fetchCurrentUser();
    } catch (_error) {
      authStore.logout();
      return { name: "Login" };
    }
  }

  // Check minimum role requirement
  const minRole = to.meta.minRole as UserRole | undefined;
  if (minRole && authStore.user) {
    const userLevel = ROLE_LEVELS[authStore.user.role];
    const requiredLevel = ROLE_LEVELS[minRole];
    if (userLevel < requiredLevel) {
      return { name: "AccessDenied" };
    }
  }
});

export default router;
