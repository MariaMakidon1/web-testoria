import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  User,
  LoginRequest,
  UserRole,
  ResetTokenValidateResponse,
} from "@/types/auth";
import { ROLE_LEVELS } from "@/types/auth";
import * as authApi from "@/api/auth";

// Pulls the backend's `detail` message off an Axios-style error, falling back
// to a generic message so views can bind to a single `error` string.
function extractError(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { detail?: string } } };
  return err.response?.data?.detail || fallback;
}

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem("access_token"));
  const refreshToken = ref<string | null>(
    localStorage.getItem("refresh_token"),
  );
  const loading = ref(false);
  const error = ref<string | null>(null);

  function hasMinRole(minRole: UserRole): boolean {
    if (!user.value) return false;
    return ROLE_LEVELS[user.value.role] >= ROLE_LEVELS[minRole];
  }

  const isAuthenticated = computed(() => !!accessToken.value);
  const isAdmin = computed(() => user.value?.role === "admin");
  const isProjectManager = computed(() => hasMinRole("lead"));
  const canManageTests = computed(() => hasMinRole("tester"));
  // User management is open to Lead and Admin (plan-098). A Lead is capped at
  // Lead — it cannot create/elevate/modify Admins; the backend (api plan 049)
  // enforces that, and the UI mirrors it via `isAdmin` on Admin-target actions.
  const canManageUsers = computed(() => hasMinRole("lead"));

  async function login(credentials: LoginRequest) {
    loading.value = true;
    try {
      const response = await authApi.login(credentials);
      setTokens(response.access_token, response.refresh_token);
      await fetchCurrentUser();
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (_error) {
      // Ignore logout errors
    } finally {
      clearAuth();
    }
  }

  async function fetchCurrentUser() {
    if (!accessToken.value) return;

    try {
      user.value = await authApi.getCurrentUser();
    } catch (error) {
      clearAuth();
      throw error;
    }
  }

  async function refreshAccessToken() {
    if (!refreshToken.value) throw new Error("No refresh token");

    const response = await authApi.refreshToken(refreshToken.value);
    setTokens(response.access_token, response.refresh_token);
  }

  // --- Password recovery (pre-auth) ----------------------------------------
  // These power the public forgot/reset/set-password screens. Components still
  // go component → store → api (invariant #1); the views bind to `loading`/`error`.

  // Mirrors backend no-enumeration: a real network failure rejects, but a
  // matched-or-not email both succeed (202). The view shows one confirmation.
  async function forgotPassword(email: string) {
    loading.value = true;
    error.value = null;
    try {
      await authApi.forgotPassword({ email });
    } catch (e) {
      error.value = extractError(e, "Could not send the reset email");
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function resetPassword(token: string, newPassword: string) {
    loading.value = true;
    error.value = null;
    try {
      await authApi.resetPassword({ token, new_password: newPassword });
    } catch (e) {
      error.value = extractError(e, "Could not reset your password");
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // Resolves with the validation result on a 200, or `null` when the token is
  // invalid/expired/used (400) or unreachable — the view treats null as
  // "show the request-a-new-link recovery state".
  async function validateResetToken(
    token: string,
  ): Promise<ResetTokenValidateResponse | null> {
    loading.value = true;
    error.value = null;
    try {
      return await authApi.validateResetToken(token);
    } catch (e) {
      error.value = extractError(e, "This link is no longer valid");
      return null;
    } finally {
      loading.value = false;
    }
  }

  function setTokens(access: string, refresh: string) {
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
  }

  function clearAuth() {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  return {
    user,
    accessToken,
    refreshToken,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    isProjectManager,
    canManageTests,
    canManageUsers,
    login,
    logout,
    fetchCurrentUser,
    refreshAccessToken,
    forgotPassword,
    resetPassword,
    validateResetToken,
  };
});
