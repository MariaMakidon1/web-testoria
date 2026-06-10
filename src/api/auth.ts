import apiClient from "./client";
import type {
  LoginRequest,
  TokenResponse,
  User,
  Role,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ResetTokenValidateResponse,
} from "@/types/auth";

export async function login(credentials: LoginRequest): Promise<TokenResponse> {
  const formData = new URLSearchParams();
  formData.append("username", credentials.username);
  formData.append("password", credentials.password);

  const response = await apiClient.post<TokenResponse>(
    "/auth/login",
    formData,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    },
  );
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>("/auth/me");
  return response.data;
}

export async function refreshToken(
  refresh_token: string,
): Promise<TokenResponse> {
  const response = await apiClient.post<TokenResponse>("/auth/refresh", {
    refresh_token,
  });
  return response.data;
}

export async function getRoles(): Promise<Role[]> {
  const response = await apiClient.get<Role[]>("/roles");
  return response.data;
}

// Always resolves on a 202 from the backend regardless of whether the email
// exists — no user enumeration. The caller shows the same confirmation either way.
export async function forgotPassword(
  data: ForgotPasswordRequest,
): Promise<void> {
  await apiClient.post("/auth/forgot-password", data);
}

// Consumes a single-use token (welcome invite or reset) and sets the password.
// Rejects with a 400 if the token is invalid/expired/used.
export async function resetPassword(data: ResetPasswordRequest): Promise<void> {
  await apiClient.post("/auth/reset-password", data);
}

// Peeks a token without consuming it. Resolves with `{ valid, username }` on a
// 200; rejects with a 400 for an invalid/expired/used token.
export async function validateResetToken(
  token: string,
): Promise<ResetTokenValidateResponse> {
  const response = await apiClient.get<ResetTokenValidateResponse>(
    "/auth/reset-password/validate",
    { params: { token } },
  );
  return response.data;
}
