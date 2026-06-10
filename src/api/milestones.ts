import apiClient from "./client";
import type {
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
} from "@/types/milestone";

export async function getMilestones(projectId: number): Promise<Milestone[]> {
  const response = await apiClient.get<Milestone[]>(
    `/projects/${projectId}/milestones`,
  );
  return response.data;
}

export async function createMilestone(
  projectId: number,
  data: MilestoneCreate,
): Promise<Milestone> {
  const response = await apiClient.post<Milestone>(
    `/projects/${projectId}/milestones`,
    data,
  );
  return response.data;
}

export async function updateMilestone(
  id: number,
  data: MilestoneUpdate,
): Promise<Milestone> {
  const response = await apiClient.put<Milestone>(`/milestones/${id}`, data);
  return response.data;
}

export async function deleteMilestone(id: number): Promise<void> {
  await apiClient.delete(`/milestones/${id}`);
}
