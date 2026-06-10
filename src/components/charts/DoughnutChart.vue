<script setup lang="ts">
import { computed } from "vue";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type Plugin,
} from "chart.js";
import type { ChartData, ChartOptions } from "chart.js";
import { Doughnut } from "vue-chartjs";

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps<{
  data: ChartData<"doughnut">;
  options: ChartOptions<"doughnut">;
}>();

// Leader-line + percentage label plugin. Scoped to this component so it only
// affects the charts that use <DoughnutChart>. For each non-zero slice draws
// a short two-segment line pointing to a "<label> <pct.n>%" callout. Zero
// slices are skipped — they're still present in the side legend, but a
// leader line into an empty arc would only be noise.
const leaderLineLabelsPlugin: Plugin<"doughnut"> = {
  id: "leaderLineLabels",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;

    const dataset = chart.data.datasets[0];
    const rawValues = (dataset?.data ?? []) as (number | null | undefined)[];
    const total = rawValues.reduce<number>(
      (sum, v) => sum + (typeof v === "number" ? v : 0),
      0,
    );
    if (total <= 0) return;

    const labels = (chart.data.labels ?? []) as string[];
    const canvas = chart.canvas;
    const textColor =
      getComputedStyle(canvas).getPropertyValue("--text-color").trim() ||
      "#334155";

    ctx.save();
    ctx.fillStyle = textColor;
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 1;
    ctx.font = "600 0.75rem sans-serif";
    ctx.textBaseline = "middle";

    type Callout = {
      startX: number;
      startY: number;
      midX: number;
      midY: number;
      endX: number;
      endY: number;
      isRight: boolean;
      text: string;
    };

    const callouts: Callout[] = [];

    meta.data.forEach((arc, i) => {
      const value = rawValues[i];
      if (typeof value !== "number" || value <= 0) return;

      // Arcs expose their geometry via an internal props struct; Chart.js
      // exposes it publicly in v4 via `getProps`.
      const { x, y, outerRadius, startAngle, endAngle } = arc.getProps(
        ["x", "y", "outerRadius", "startAngle", "endAngle"],
        true,
      ) as {
        x: number;
        y: number;
        outerRadius: number;
        startAngle: number;
        endAngle: number;
      };

      const midAngle = (startAngle + endAngle) / 2;
      const cos = Math.cos(midAngle);
      const sin = Math.sin(midAngle);

      const startX = x + cos * outerRadius;
      const startY = y + sin * outerRadius;
      const midX = x + cos * (outerRadius + 10);
      const midY = y + sin * (outerRadius + 10);
      const isRight = cos >= 0;
      const endX = midX + (isRight ? 24 : -24);

      const pct = (value / total) * 100;
      const pctText = `${pct.toFixed(1)}%`;
      const label = labels[i] ?? "";
      const text = label ? `${label} ${pctText}` : pctText;

      callouts.push({
        startX,
        startY,
        midX,
        midY,
        endX,
        endY: midY,
        isRight,
        text,
      });
    });

    // Spread overlapping callouts on each side. Thin slices (<=5%) cluster
    // their natural Y around the same point, so without this pass labels
    // print on top of each other.
    const minGap = 16;
    const top = 4;
    const bottom = chart.height - 4;

    const spread = (group: Callout[]) => {
      if (group.length < 2) return;
      group.sort((a, b) => a.endY - b.endY);
      // Forward pass: push each label down so it clears the previous one.
      for (let k = 1; k < group.length; k++) {
        const prev = group[k - 1];
        if (group[k].endY < prev.endY + minGap) {
          group[k].endY = prev.endY + minGap;
        }
      }
      // Backward pass: if the last label overflowed the bottom, cascade
      // upward keeping the gap intact.
      if (group[group.length - 1].endY > bottom) {
        group[group.length - 1].endY = bottom;
        for (let k = group.length - 2; k >= 0; k--) {
          if (group[k].endY > group[k + 1].endY - minGap) {
            group[k].endY = group[k + 1].endY - minGap;
          }
        }
      }
      // Final forward pass: clamp the top in case the cascade pushed
      // labels above the canvas.
      if (group[0].endY < top) {
        group[0].endY = top;
        for (let k = 1; k < group.length; k++) {
          if (group[k].endY < group[k - 1].endY + minGap) {
            group[k].endY = group[k - 1].endY + minGap;
          }
        }
      }
    };

    spread(callouts.filter((c) => c.isRight));
    spread(callouts.filter((c) => !c.isRight));

    callouts.forEach((c) => {
      ctx.beginPath();
      ctx.moveTo(c.startX, c.startY);
      ctx.lineTo(c.midX, c.midY);
      ctx.lineTo(c.endX, c.endY);
      ctx.stroke();

      ctx.textAlign = c.isRight ? "left" : "right";
      const textX = c.endX + (c.isRight ? 4 : -4);
      ctx.fillText(c.text, textX, c.endY);
    });

    ctx.restore();
  },
};

// Leader-line labels render outside the ring, so the chart needs padding on
// all sides to avoid clipping.
const mergedOptions = computed<ChartOptions<"doughnut">>(() => {
  const base = props.options ?? {};
  return {
    ...base,
    layout: {
      ...(base.layout ?? {}),
      padding: {
        top: 24,
        right: 72,
        bottom: 24,
        left: 72,
        ...(typeof base.layout?.padding === "object" ? base.layout.padding : {}),
      },
    },
  };
});

const plugins = [leaderLineLabelsPlugin];
</script>

<template>
  <Doughnut :data="data" :options="mergedOptions" :plugins="plugins" />
</template>
