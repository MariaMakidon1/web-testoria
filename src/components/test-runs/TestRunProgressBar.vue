<script setup lang="ts">
import { computed } from "vue";
import type { TestRunProgress } from "@/types/testRun";

const props = defineProps<{
  progress: TestRunProgress;
}>();

const segments = computed(() => {
  const t = props.progress.total;
  if (t === 0) return [];

  const pct = (n: number) => (n / t) * 100;
  const passed = pct(props.progress.passed);
  const failed = pct(props.progress.failed);
  const blocked = pct(props.progress.blocked);
  const noRun = pct(props.progress.no_run);

  const result: { key: string; width: number; color: string; label: string }[] =
    [];

  if (passed > 0)
    result.push({
      key: "passed",
      width: passed,
      color: "#22c55e",
      label: `Passed: ${props.progress.passed}`,
    });
  if (failed > 0)
    result.push({
      key: "failed",
      width: failed,
      color: "#ef4444",
      label: `Failed: ${props.progress.failed}`,
    });
  if (blocked > 0)
    result.push({
      key: "blocked",
      width: blocked,
      color: "#4b5563",
      label: `Blocked: ${props.progress.blocked}`,
    });
  if (noRun > 0)
    result.push({
      key: "no_run",
      width: noRun,
      color: "#9ca3af",
      label: `No Run: ${props.progress.no_run}`,
    });

  if (result.length > 0) {
    const sum = result.reduce((s, seg) => s + seg.width, 0);
    result[result.length - 1].width += 100 - sum;
    if (result[result.length - 1].width > 100)
      result[result.length - 1].width = 100;
  }

  return result;
});

const ariaLabel = computed(() => {
  const p = props.progress;
  return `Progress: ${p.passed} passed, ${p.failed} failed, ${p.blocked} blocked, ${p.no_run} no run out of ${p.total} total`;
});
</script>

<template>
  <div
    class="progress-bar-segmented"
    role="progressbar"
    :aria-label="ariaLabel"
    :aria-valuenow="progress.total - progress.no_run"
    :aria-valuemax="progress.total"
  >
    <template v-if="segments.length > 0">
      <div
        v-for="seg in segments"
        :key="seg.key"
        class="segment"
        :style="{ width: seg.width + '%', backgroundColor: seg.color }"
        :title="seg.label"
      />
    </template>
  </div>
</template>

<style scoped>
.progress-bar-segmented {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--surface-200);
  width: 100%;
}

.segment {
  height: 100%;
  transition: width 0.3s ease;
}
</style>
