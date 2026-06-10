import type { StepResult, ResultStatus } from "@/types/testResult";

export function suggestOverallStatus(
  stepResults: StepResult[],
  stepCount: number,
): ResultStatus | null {
  if (stepResults.length === 0) return "no_run";

  const statuses = stepResults.map((r) => r.status);

  if (statuses.includes("failed")) return "failed";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.every((s) => s === "no_run")) return "no_run";
  if (statuses.every((s) => s === "passed") && stepResults.length === stepCount)
    return "passed";

  return "no_run";
}
