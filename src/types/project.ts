export interface Project {
  id: number;
  name: string;
  description: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  is_archived?: boolean;
}

export interface ProjectStats {
  total_test_cases: number;
  total_test_runs: number;
  total_test_suites: number;
  pass_rate: number;
}

export interface ProjectStatsItem {
  project_id: number;
  name: string;
  is_archived: boolean;
  total_test_cases: number;
  total_test_suites: number;
  total_test_runs: number;
  active_runs: number;
  pass_rate: number | null;
}

export interface ProjectStatsBulkResponse {
  items: ProjectStatsItem[];
  total: number;
}

export interface ProjectStatsBulkParams {
  include_archived?: boolean;
  project_ids?: number[];
}
