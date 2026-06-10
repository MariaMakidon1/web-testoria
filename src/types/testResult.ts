export interface TestResult {
  id: number | null;
  test_run_id: number;
  test_case_id: number;
  status: ResultStatus;
  comment: string | null;
  message: string | null;
  stack_trace: string | null;
  execution_time: number | null;
  defects: Defect[] | null;
  tested_by: number | null;
  tested_at: string;
  step_results?: StepResult[] | null;
  attachments?: Attachment[];
  test_case?: TestResultTestCase;
}

export interface TestResultTestCase {
  id: number;
  title: string;
  type: string;
  priority: string;
}

export type ResultStatus = "passed" | "failed" | "blocked" | "no_run";

export interface StepResult {
  index: number;
  status: ResultStatus;
  comment?: string | null;
}

export interface Defect {
  tracker: "jira" | "github" | "gitlab" | "custom";
  key: string;
  url?: string;
  summary?: string;
}

export interface Attachment {
  id: number;
  filename: string;
  file_size: number;
  mime_type: string | null;
  uploaded_at: string;
  storage_backend?: "s3" | "local";
  object_key?: string;
  url: string;
}

export interface BulkUploadFailure {
  filename: string;
  reason: string;
}

export interface BulkUploadResponse {
  uploaded: Attachment[];
  failed: BulkUploadFailure[];
}

export interface TestResultCreate {
  test_case_id: number;
  status: ResultStatus;
  comment?: string;
  execution_time?: number;
  defects?: Defect[];
  step_results?: StepResult[];
}

export interface TestResultUpdate {
  status?: ResultStatus;
  comment?: string;
  execution_time?: number;
  defects?: Defect[];
  step_results?: StepResult[];
}

export const RESULT_STATUSES: ResultStatus[] = [
  "passed",
  "failed",
  "blocked",
  "no_run",
];

export const RESULT_STATUS_COLORS: Record<ResultStatus, string> = {
  passed: "#22c55e",
  failed: "#ef4444",
  blocked: "#4b5563",
  no_run: "#9ca3af",
};

export const RESULT_STATUS_ICONS: Record<ResultStatus, string> = {
  passed: "pi pi-check-circle",
  failed: "pi pi-times-circle",
  blocked: "pi pi-ban",
  no_run: "pi pi-minus-circle",
};

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  passed: "Passed",
  failed: "Failed",
  blocked: "Blocked",
  no_run: "No Run",
};

export interface TestResultHistory {
  id: number;
  test_result_id: number;
  status: ResultStatus;
  comment: string | null;
  changed_by: number;
  changed_at: string;
}
