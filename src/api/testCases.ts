import apiClient from "./client";
import type {
  TestCase,
  TestCaseCreate,
  TestCaseUpdate,
} from "@/types/testCase";
import type { PaginatedResponse } from "@/types/api";

export interface TestCaseFilters {
  suite_id?: number;
  priority?: string;
  type?: string;
  status?: string;
  search?: string;
  tag_ids?: number[];
  page?: number;
  page_size?: number;
}

export async function getTestCases(
  projectId: number,
  filters: TestCaseFilters = {},
): Promise<PaginatedResponse<TestCase>> {
  const response = await apiClient.get<PaginatedResponse<TestCase>>(
    `/projects/${projectId}/test-cases`,
    {
      params: filters,
      paramsSerializer: {
        indexes: null,
      },
    },
  );
  return response.data;
}

export async function getTestCase(id: number): Promise<TestCase> {
  const response = await apiClient.get<TestCase>(`/test-cases/${id}`);
  return response.data;
}

export async function createTestCase(
  projectId: number,
  data: TestCaseCreate,
): Promise<TestCase> {
  const response = await apiClient.post<TestCase>(
    `/projects/${projectId}/test-cases`,
    data,
  );
  return response.data;
}

export async function updateTestCase(
  id: number,
  data: TestCaseUpdate,
): Promise<TestCase> {
  const response = await apiClient.put<TestCase>(`/test-cases/${id}`, data);
  return response.data;
}

export async function deleteTestCase(id: number): Promise<void> {
  await apiClient.delete(`/test-cases/${id}`);
}

export async function importTestCases(
  projectId: number,
  file: File,
  suiteId: number,
): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("suite_id", suiteId.toString());

  const response = await apiClient.post<{ imported: number; errors: string[] }>(
    `/projects/${projectId}/test-cases/import`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );
  return response.data;
}

export async function exportTestCases(
  projectId: number,
  format: "csv" | "excel" = "csv",
): Promise<Blob> {
  const response = await apiClient.get(
    `/projects/${projectId}/test-cases/export`,
    {
      params: { format },
      responseType: "blob",
    },
  );
  return response.data;
}
