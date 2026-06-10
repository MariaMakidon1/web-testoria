import type { TestCase } from "./testCase";
import type { TestResult } from "./testResult";

export interface TestRun {
  id: number;
  project_id: number;
  suite_id: number | null;
  milestone_id: number | null;
  name: string;
  config: TestRunConfig | null;
  assigned_to: number | null;
  status: TestRunStatus;
  cases_mode?: TestRunCasesMode;
  created_at: string;
  completed_at: string | null;
  progress?: TestRunProgress;
}

export interface TestRunConfig {
  environment?: string;
  browser?: string;
  os?: string;
  build_number?: string;
  [key: string]: string | undefined;
}

export type TestRunStatus = "planned" | "active" | "completed" | "aborted";

// Legacy wire-format status value emitted by backends pre api plan-039.
// Incoming responses are normalised to `active` at the api-adapter boundary
// (`normaliseRunStatus` in `src/api/testRuns.ts`); the rest of the app only
// ever sees the canonical value.
export type WireTestRunStatus = TestRunStatus | "in_progress";

export type TestRunCasesMode = "auto" | "explicit";

export interface TestRunProgress {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  no_run: number;
  pass_rate: number | null;
}

export interface TestRunCreate {
  name: string;
  suite_id?: number;
  milestone_id?: number;
  assigned_to?: number;
  config?: TestRunConfig;
  include_test_cases?: number[];
}

export interface TestRunUpdate {
  name?: string;
  assigned_to?: number;
  config?: TestRunConfig;
  status?: TestRunStatus;
}

export interface TestCaseWithResult extends TestCase {
  result: TestResult | null;
}

export interface TestRunWithCases {
  run: TestRun;
  cases: TestCaseWithResult[];
}

export const TEST_RUN_STATUSES: TestRunStatus[] = [
  "planned",
  "active",
  "completed",
  "aborted",
];

export const RUN_STATUS_LABELS: Record<TestRunStatus, string> = {
  planned: "Planned",
  active: "Active",
  completed: "Completed",
  aborted: "Aborted",
};
