import apiClient from "./client";
import type { Tag } from "@/types/testCase";

export async function getTags(): Promise<Tag[]> {
  const response = await apiClient.get<Tag[]>("/tags");
  return response.data;
}

export async function searchTags(
  q: string,
  limit: number = 20,
): Promise<Tag[]> {
  const response = await apiClient.get<Tag[]>("/tags", {
    params: { q, limit },
  });
  return response.data;
}

export async function createTag(data: { name: string }): Promise<Tag> {
  const response = await apiClient.post<Tag>("/tags", data);
  return response.data;
}
