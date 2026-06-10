import apiClient from "./client";
import type {
  CrossProjectReportAnalytics,
  CrossProjectReportAnalyticsParams,
  DashboardData,
  ProjectMetrics,
  ProjectReportAnalytics,
  ReportAnalyticsParams,
  TestRunMetrics,
  CustomReportRequest,
  CustomReportResponse,
} from "@/types/report";

export async function getDashboardData(
  projectId: number,
): Promise<DashboardData> {
  const response = await apiClient.get<DashboardData>(
    `/projects/${projectId}/dashboard`,
  );
  return response.data;
}

export async function getTestRunMetrics(
  runId: number,
): Promise<TestRunMetrics> {
  const response = await apiClient.get<TestRunMetrics>(
    `/test-runs/${runId}/report`,
    {
      params: { format: "json" },
    },
  );
  return response.data;
}

export async function downloadReport(
  runId: number,
  format: "pdf" | "excel",
): Promise<Blob> {
  const response = await apiClient.get(`/test-runs/${runId}/report`, {
    params: { format },
    responseType: "blob",
  });
  return response.data;
}

export async function getProjectMetrics(
  projectId: number,
  days = 30,
): Promise<ProjectMetrics> {
  const response = await apiClient.get<ProjectMetrics>(
    `/projects/${projectId}/metrics`,
    {
      params: { days },
    },
  );
  return response.data;
}

export async function getCustomReport(
  filters: CustomReportRequest,
): Promise<CustomReportResponse> {
  const response = await apiClient.post<CustomReportResponse>(
    "/reports/custom",
    filters,
  );
  return response.data;
}

export async function getProjectReportAnalytics(
  projectId: number,
  params: ReportAnalyticsParams = {},
): Promise<ProjectReportAnalytics> {
  const response = await apiClient.get<ProjectReportAnalytics>(
    `/projects/${projectId}/report-analytics`,
    { params },
  );
  return response.data;
}

export async function getCrossProjectReportAnalytics(
  params: CrossProjectReportAnalyticsParams = {},
): Promise<CrossProjectReportAnalytics> {
  const response = await apiClient.get<CrossProjectReportAnalytics>(
    "/reports/analytics",
    {
      params,
      paramsSerializer: { indexes: null },
    },
  );
  return response.data;
}
