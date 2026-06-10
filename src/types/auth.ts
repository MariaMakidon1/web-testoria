export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export type UserRole = "no_access" | "read_only" | "tester" | "lead" | "admin";

export const ROLE_LEVELS: Record<UserRole, number> = {
  no_access: 0,
  read_only: 1,
  tester: 2,
  lead: 3,
  admin: 4,
};

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResetTokenValidateResponse {
  valid: boolean;
  username: string;
}

export interface TokenPayload {
  sub: number;
  username: string;
  role: UserRole;
  exp: number;
  type: "access" | "refresh";
}

export interface Role {
  name: UserRole;
  description: string;
  level: number;
}
