import { RESULT_STATUS_LABELS, type ResultStatus } from "@/types/testResult";

export function statusLabelFallback(status: string): string {
  return status
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function statusLabel(status: string | null | undefined): string {
  if (status == null || status === "") return "—";
  const mapped = RESULT_STATUS_LABELS[status as ResultStatus];
  if (mapped) return mapped;
  return statusLabelFallback(status);
}
