import apiClient from "./client";
import type {
  TestSuite,
  TestSuiteCreate,
  TestSuiteUpdate,
} from "@/types/testSuite";

export async function getTestSuites(projectId: number): Promise<TestSuite[]> {
  const response = await apiClient.get<TestSuite[]>(
    `/projects/${projectId}/test-suites`,
  );
  return response.data;
}

export async function getTestSuite(id: number): Promise<TestSuite> {
  const response = await apiClient.get<TestSuite>(`/test-suites/${id}`);
  return response.data;
}

export async function createTestSuite(
  projectId: number,
  data: TestSuiteCreate,
): Promise<TestSuite> {
  const response = await apiClient.post<TestSuite>(
    `/projects/${projectId}/test-suites`,
    data,
  );
  return response.data;
}

export async function updateTestSuite(
  id: number,
  data: TestSuiteUpdate,
): Promise<TestSuite> {
  const response = await apiClient.put<TestSuite>(`/test-suites/${id}`, data);
  return response.data;
}

export async function deleteTestSuite(id: number): Promise<void> {
  await apiClient.delete(`/test-suites/${id}`);
}
