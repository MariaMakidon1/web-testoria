import apiClient from "./client";
import type { User } from "@/types/auth";
import type {
  UserCreate,
  UserUpdate,
  UserBulkCreate,
  UserBulkResult,
  UserFilters,
} from "@/types/user";
import type { PaginatedResponse } from "@/types/api";

export async function getUsers(
  filters: UserFilters = {},
): Promise<PaginatedResponse<User>> {
  const response = await apiClient.get<PaginatedResponse<User>>("/users", {
    params: filters,
  });
  return response.data;
}

export async function getUser(id: number): Promise<User> {
  const response = await apiClient.get<User>(`/users/${id}`);
  return response.data;
}

export async function createUser(data: UserCreate): Promise<User> {
  const response = await apiClient.post<User>("/users", data);
  return response.data;
}

export async function bulkCreateUsers(
  data: UserBulkCreate,
): Promise<UserBulkResult> {
  const response = await apiClient.post<UserBulkResult>("/users/bulk", data);
  return response.data;
}

export async function updateUser(id: number, data: UserUpdate): Promise<User> {
  const response = await apiClient.put<User>(`/users/${id}`, data);
  return response.data;
}

export async function deleteUser(id: number): Promise<void> {
  await apiClient.delete(`/users/${id}`);
}

export async function exportUsers(
  format: "csv" | "excel" = "csv",
): Promise<Blob> {
  const response = await apiClient.get("/users/export", {
    params: { format },
    responseType: "blob",
  });
  return response.data;
}
