import type { User, UserRole } from "./auth";

export type { User, UserRole };

export interface UserCreate {
  // Invite-only (plan-098 / api 049): there is no password at creation, single
  // or bulk. The backend creates the account with an unusable password and
  // emails an invite link so the user sets their own.
  username: string;
  email: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  role?: UserRole;
  is_active?: boolean;
  password?: string;
}

export interface UserBulkCreate {
  users: UserCreate[];
}

// Mirrors the backend `BulkCreateError` — `detail` is a specific message (e.g.
// "Email 'x@y.com' is already taken"); `username`/`email` echo the failing row.
export interface BulkCreateError {
  index: number;
  username?: string;
  email?: string;
  detail: string;
}

export interface UserBulkResult {
  created: number;
  errors: BulkCreateError[];
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}
