import { describe, it, expect } from "vitest";
import { statusLabel, statusLabelFallback } from "@/utils/statusLabel";

describe("statusLabel", () => {
  it("returns the mapped label for known statuses", () => {
    expect(statusLabel("passed")).toBe("Passed");
    expect(statusLabel("failed")).toBe("Failed");
    expect(statusLabel("blocked")).toBe("Blocked");
    expect(statusLabel("no_run")).toBe("No Run");
  });

  it("falls back to Title-Case for unknown statuses", () => {
    expect(statusLabel("retest")).toBe("Retest");
    expect(statusLabel("in_progress")).toBe("In Progress");
    expect(statusLabel("foo-bar")).toBe("Foo Bar");
  });

  it("returns em-dash for nullish or empty", () => {
    expect(statusLabel(null)).toBe("—");
    expect(statusLabel(undefined)).toBe("—");
    expect(statusLabel("")).toBe("—");
  });
});

describe("statusLabelFallback", () => {
  it("title-cases a snake_case string", () => {
    expect(statusLabelFallback("no_run")).toBe("No Run");
    expect(statusLabelFallback("in_progress")).toBe("In Progress");
  });
});
