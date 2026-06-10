export interface TestStep {
  step: string;
  expected: string;
}

export interface TestCase {
  id: number;
  suite_id: number;
  title: string;
  description: string | null;
  preconditions: string | null;
  steps: TestStep[];
  priority: Priority;
  type: TestCaseType;
  status: TestCaseStatus;
  created_at: string;
  updated_at: string | null;
  tags?: Tag[];
  automation_id?: string | null;
  display_order?: number | null;
}

export type Priority = "critical" | "high" | "medium" | "low";
export type TestCaseType = "manual" | "automated";
export type TestCaseStatus = "draft" | "active" | "deprecated";

export interface Tag {
  id: number;
  name: string;
}

export interface TestCaseCreate {
  suite_id: number;
  title: string;
  description?: string;
  preconditions?: string;
  steps: TestStep[];
  priority?: Priority;
  type?: TestCaseType;
  status?: TestCaseStatus;
  tag_ids?: number[];
  automation_id?: string | null;
}

export interface TestCaseUpdate {
  title?: string;
  description?: string;
  preconditions?: string;
  steps?: TestStep[];
  priority?: Priority;
  type?: TestCaseType;
  status?: TestCaseStatus;
  suite_id?: number;
  tags?: string[];
  automation_id?: string | null;
  display_order?: number | null;
}

export function getPrioritySeverity(
  priority: string,
): "danger" | "warning" | "info" | "success" {
  const map: Record<string, "danger" | "warning" | "info" | "success"> = {
    critical: "danger",
    high: "warning",
    medium: "info",
    low: "success",
  };
  return map[priority] || "info";
}

export const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
export const TEST_CASE_TYPES: TestCaseType[] = ["manual", "automated"];
export const TEST_CASE_STATUSES: TestCaseStatus[] = [
  "draft",
  "active",
  "deprecated",
];

export const PRIORITY_LABELS: Record<Priority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TYPE_LABELS: Record<TestCaseType, string> = {
  manual: "Manual",
  automated: "Automated",
};

export const STATUS_LABELS: Record<TestCaseStatus, string> = {
  draft: "Draft",
  active: "Active",
  deprecated: "Deprecated",
};
