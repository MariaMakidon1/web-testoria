export interface FormatPassRateOptions {
  decimals?: number;
  fallback?: string;
}

let warnedAboutLegacyScale = false;

export function toPercent(
  ratio: number | null | undefined,
): number | null {
  if (ratio == null || Number.isNaN(ratio)) return null;
  if (ratio > 1.5) {
    if (!warnedAboutLegacyScale) {
      warnedAboutLegacyScale = true;
       
      console.warn(
        "[passRate] Received value > 1.5; assuming legacy 0..100 scale. Check API plan 035 rollout.",
      );
    }
    return ratio;
  }
  return ratio * 100;
}

export function formatPassRate(
  ratio: number | null | undefined,
  opts: FormatPassRateOptions = {},
): string {
  const { decimals = 1, fallback = "—" } = opts;
  const pct = toPercent(ratio);
  if (pct == null) return fallback;
  return `${pct.toFixed(decimals)}%`;
}

/**
 * Convert a 0..1 ratio to a number percent rounded to `decimals` places.
 *
 * Use when a number is needed (insight thresholds, chart-axis ticks) — for
 * rendered text use `formatPassRate` instead. Both share the same rounding
 * rule so a value displayed as "87.5%" compares as `87.5`. See plan-083.
 */
export function toPercentRounded(
  ratio: number | null | undefined,
  decimals = 1,
): number | null {
  const pct = toPercent(ratio);
  if (pct == null) return null;
  const factor = 10 ** decimals;
  return Math.round(pct * factor) / factor;
}
