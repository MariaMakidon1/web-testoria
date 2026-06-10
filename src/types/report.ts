import type { TestRun } from "./testRun";

export interface DashboardData {
  total_test_cases: number;
  total_test_suites: number;
  total_test_runs: number;
  pass_rate: number;
  recent_runs: TestRun[];
  status_distribution: Record<string, number>;
}

export interface TestRunMetrics {
  test_run_id: number;
  pass_rate: number;
  total_tests: number;
  executed_tests: number;
  execution_progress: number;
  status_breakdown: Record<string, number>;
  average_execution_time: number;
  estimated_remaining_time: number;
}

export interface TrendData {
  date: string;
  pass_rate: number;
  total_tests: number;
  passed: number;
  failed: number;
}

export interface ProjectMetrics {
  project_id: number;
  total_test_cases: number;
  total_test_runs: number;
  total_test_results: number;
  automation_coverage: number;
  average_pass_rate: number;
  trend_data: TrendData[];
  priority_distribution: Record<string, number>;
  type_distribution: Record<string, number>;
}

export interface CustomReportRequest {
  project_id: number;
  suite_id?: number;
  run_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export interface CustomReportResponse {
  items: CustomReportItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface CustomReportItem {
  test_case_id: number;
  test_case_title: string;
  test_run_id: number;
  test_run_name: string;
  status: string;
  tested_by: number | null;
  tested_at: string | null;
  execution_time: number | null;
}

export interface RunAnalyticsItem {
  id: number;
  project_id: number;
  // Populated only by the cross-project analytics endpoint — the per-project
  // endpoint already knows the project from the URL and skips the join.
  project_name?: string | null;
  name: string;
  status: string;
  milestone_id: number | null;
  assigned_to: number | null;
  passed: number;
  failed: number;
  blocked: number;
  no_run: number;
  total: number;
  pass_rate: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface TestCaseDistribution {
  by_priority: Record<string, number>;
  by_type: Record<string, number>;
  by_automation: Record<string, number>;
}

export interface TrendPoint {
  date: string;
  passed: number;
  failed: number;
  blocked: number;
  no_run: number;
  total: number;
  pass_rate: number | null;
}

export interface ReportAnalyticsSummary {
  total_test_cases: number;
  total_test_suites: number;
  total_test_runs: number;
  active_runs: number;
  overall_pass_rate: number;
  total_results: number;
  result_distribution: Record<string, number>;
}

export interface ProjectReportAnalytics {
  project_id: number;
  date_from: string | null;
  date_to: string | null;
  summary: ReportAnalyticsSummary;
  runs: RunAnalyticsItem[];
  test_case_distribution: TestCaseDistribution;
  trend: TrendPoint[];
}

export interface ReportAnalyticsParams {
  date_from?: string;
  date_to?: string;
  run_status?: string;
  include_trend?: boolean;
}

export interface PerProjectAnalyticsRow {
  project_id: number;
  project_name: string;
  is_archived: boolean;
  total_test_runs: number;
  completed_runs: number;
  overall_pass_rate: number | null;
  total_results: number;
}

export interface CrossProjectReportAnalytics {
  project_ids: number[] | null;
  date_from: string | null;
  date_to: string | null;
  summary: ReportAnalyticsSummary;
  runs: RunAnalyticsItem[];
  test_case_distribution: TestCaseDistribution;
  trend: TrendPoint[];
  per_project: PerProjectAnalyticsRow[];
}

export interface CrossProjectReportAnalyticsParams {
  project_ids?: number[];
  date_from?: string;
  date_to?: string;
  run_status?: string;
  include_trend?: boolean;
  include_archived?: boolean;
}
