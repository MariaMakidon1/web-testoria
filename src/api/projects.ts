import apiClient from "./client";
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectStats,
  ProjectStatsBulkParams,
  ProjectStatsBulkResponse,
} from "@/types/project";
import type { PaginatedResponse } from "@/types/api";

export interface ProjectFilters {
  include_archived?: boolean;
  page?: number;
  page_size?: number;
}

export async function getProjects(
  filters: ProjectFilters = {},
): Promise<PaginatedResponse<Project>> {
  const response = await apiClient.get<PaginatedResponse<Project>>(
    "/projects",
    {
      params: filters,
    },
  );
  return response.data;
}

export async function getProject(id: number): Promise<Project> {
  const response = await apiClient.get<Project>(`/projects/${id}`);
  return response.data;
}

export async function createProject(data: ProjectCreate): Promise<Project> {
  const response = await apiClient.post<Project>("/projects", data);
  return response.data;
}

export async function updateProject(
  id: number,
  data: ProjectUpdate,
): Promise<Project> {
  const response = await apiClient.put<Project>(`/projects/${id}`, data);
  return response.data;
}

export async function deleteProject(id: number): Promise<void> {
  await apiClient.delete(`/projects/${id}`);
}

export async function getProjectStats(id: number): Promise<ProjectStats> {
  const response = await apiClient.get<ProjectStats>(`/projects/${id}/stats`);
  return response.data;
}

export async function getProjectStatsBulk(
  params: ProjectStatsBulkParams = {},
): Promise<ProjectStatsBulkResponse> {
  const response = await apiClient.get<ProjectStatsBulkResponse>(
    "/projects/stats",
    {
      params,
      paramsSerializer: { indexes: null },
    },
  );
  return response.data;
}
