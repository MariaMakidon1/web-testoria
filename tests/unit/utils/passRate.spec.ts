import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatPassRate, toPercent, toPercentRounded } from "@/utils/passRate";

describe("toPercent", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("scales a 0..1 ratio to 0..100", () => {
    expect(toPercent(0)).toBe(0);
    expect(toPercent(0.8)).toBeCloseTo(80);
    expect(toPercent(1)).toBe(100);
  });

  it("returns null for nullish input", () => {
    expect(toPercent(null)).toBeNull();
    expect(toPercent(undefined)).toBeNull();
  });

  it("passes values > 1.5 through unchanged (legacy 0..100 guard)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(toPercent(80)).toBe(80);
  });
});

describe("formatPassRate", () => {
  it("renders a ratio with the default 1-decimal precision", () => {
    expect(formatPassRate(0.8)).toBe("80.0%");
    expect(formatPassRate(0.123)).toBe("12.3%");
  });

  it("honours the decimals option", () => {
    expect(formatPassRate(0.8, { decimals: 0 })).toBe("80%");
    expect(formatPassRate(0.1234, { decimals: 2 })).toBe("12.34%");
  });

  it("returns the fallback for nullish input", () => {
    expect(formatPassRate(null)).toBe("—");
    expect(formatPassRate(undefined, { fallback: "N/A" })).toBe("N/A");
  });

  it("renders 100% when ratio is 1", () => {
    expect(formatPassRate(1)).toBe("100.0%");
  });
});

describe("toPercentRounded", () => {
  it("rounds a 0..1 ratio to a 1-decimal percent number by default", () => {
    expect(toPercentRounded(0.875)).toBe(87.5);
    expect(toPercentRounded(0.123456)).toBe(12.3);
    expect(toPercentRounded(0)).toBe(0);
    expect(toPercentRounded(1)).toBe(100);
  });

  it("returns null for nullish input (matches toPercent)", () => {
    expect(toPercentRounded(null)).toBeNull();
    expect(toPercentRounded(undefined)).toBeNull();
  });

  it("honours a custom decimals argument", () => {
    expect(toPercentRounded(0.123456, 2)).toBe(12.35);
    expect(toPercentRounded(0.123456, 0)).toBe(12);
  });

  it("agrees with formatPassRate at the same precision", () => {
    // Sanity: number form and string form for the same ratio are consistent.
    expect(toPercentRounded(0.875)).toBe(87.5);
    expect(formatPassRate(0.875)).toBe("87.5%");
    expect(toPercentRounded(0.667)).toBe(66.7);
    expect(formatPassRate(0.667)).toBe("66.7%");
  });
});
