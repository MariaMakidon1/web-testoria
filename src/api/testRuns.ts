import apiClient from "./client";
import type {
  TestRun,
  TestRunCreate,
  TestRunUpdate,
  TestRunProgress,
  TestRunWithCases,
  TestRunStatus,
  WireTestRunStatus,
} from "@/types/testRun";
import type { PaginatedResponse } from "@/types/api";

// Maps the legacy wire value `in_progress` → canonical `active`.
// The rest of the app only ever observes the canonical status.
function normaliseRunStatus(status: WireTestRunStatus): TestRunStatus {
  return status === "in_progress" ? "active" : status;
}

function normaliseRun(run: TestRun): TestRun {
  const wire = run.status as unknown as WireTestRunStatus;
  return { ...run, status: normaliseRunStatus(wire) };
}

export interface TestRunFilters {
  status?: string;
  milestone_id?: number;
  assigned_to?: number;
  page?: number;
  page_size?: number;
  include?: "progress";
}

export async function getTestRuns(
  projectId: number,
  filters: TestRunFilters = {},
): Promise<PaginatedResponse<TestRun>> {
  const response = await apiClient.get<PaginatedResponse<TestRun>>(
    `/projects/${projectId}/test-runs`,
    { params: filters },
  );
  return { ...response.data, items: response.data.items.map(normaliseRun) };
}

export async function getTestRun(id: number): Promise<TestRun> {
  const response = await apiClient.get<TestRun>(`/test-runs/${id}`);
  return normaliseRun(response.data);
}

export async function createTestRun(
  projectId: number,
  data: TestRunCreate,
): Promise<TestRun> {
  const response = await apiClient.post<TestRun>(
    `/projects/${projectId}/test-runs`,
    data,
  );
  return normaliseRun(response.data);
}

export async function updateTestRun(
  id: number,
  data: TestRunUpdate,
): Promise<TestRun> {
  const response = await apiClient.put<TestRun>(`/test-runs/${id}`, data);
  return normaliseRun(response.data);
}

export async function deleteTestRun(id: number): Promise<void> {
  await apiClient.delete(`/test-runs/${id}`);
}

export async function closeTestRun(id: number): Promise<TestRun> {
  const response = await apiClient.post<TestRun>(`/test-runs/${id}/close`);
  return normaliseRun(response.data);
}

export async function getTestRunProgress(id: number): Promise<TestRunProgress> {
  const response = await apiClient.get<TestRunProgress>(
    `/test-runs/${id}/progress`,
  );
  return response.data;
}

export async function getTestRunCases(id: number): Promise<TestRunWithCases> {
  const response = await apiClient.get<TestRunWithCases>(
    `/test-runs/${id}/cases`,
  );
  return { ...response.data, run: normaliseRun(response.data.run) };
}

export async function setRunCases(
  id: number,
  testCaseIds: number[],
): Promise<TestRun> {
  const response = await apiClient.put<TestRun>(`/test-runs/${id}/cases`, {
    test_case_ids: testCaseIds,
  });
  return normaliseRun(response.data);
}
