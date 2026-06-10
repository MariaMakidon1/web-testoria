<script setup lang="ts">
import { computed } from "vue";
import type { TestResult, TestResultHistory } from "@/types/testResult";
import { RESULT_STATUS_COLORS } from "@/types/testResult";
import StatusBadge from "@/components/common/StatusBadge.vue";
import Timeline from "primevue/timeline";

const props = defineProps<{
  history: TestResultHistory[];
  result: TestResult;
}>();

interface TimelineEvent {
  id: number;
  status: string;
  user: string;
  date: string;
  comment: string | null;
  color: string;
  repeatCount: number;
}

const timelineEvents = computed<TimelineEvent[]>(() => {
  // Fallback when history hasn't loaded yet: render a single event from the
  // current result so the panel is never blank.
  if (props.history.length === 0) {
    return [
      {
        id: 0,
        status: props.result.status,
        user: props.result.tested_by
          ? `User #${props.result.tested_by}`
          : "Unknown",
        date: formatDate(props.result.tested_at),
        comment: props.result.comment,
        color: RESULT_STATUS_COLORS[props.result.status] || "#94a3b8",
        repeatCount: 1,
      },
    ];
  }

  // Backend returns ASC; we want newest-first.
  const ordered = [...props.history].reverse();
  const collapsed: TimelineEvent[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const h = ordered[i];
    const last = collapsed[collapsed.length - 1];
    const sameAsLast =
      last &&
      last.status === h.status &&
      (last.comment ?? null) === (h.comment ?? null) &&
      last.user === `User #${h.changed_by}`;
    if (sameAsLast) {
      last.repeatCount += 1;
      continue;
    }
    collapsed.push({
      id: h.id || i + 1,
      status: h.status,
      user: `User #${h.changed_by}`,
      date: formatDate(h.changed_at),
      comment: h.comment,
      color: RESULT_STATUS_COLORS[h.status] || "#94a3b8",
      repeatCount: 1,
    });
  }
  return collapsed;
});

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="history-panel">
    <div v-if="timelineEvents.length === 0" class="empty-history">
      <i class="pi pi-history"></i>
      <p>No history available for this test result</p>
    </div>

    <Timeline v-else :value="timelineEvents" class="history-timeline">
      <template #marker="{ item }">
        <div
          class="timeline-marker"
          :style="{ backgroundColor: item.color }"
        ></div>
      </template>

      <template #content="{ item }">
        <div class="timeline-event">
          <div class="event-header">
            <StatusBadge :value="item.status" type="result" size="small" />
            <span v-if="item.repeatCount > 1" class="event-repeat"
              >×{{ item.repeatCount }}</span
            >
            <span class="event-date">{{ item.date }}</span>
          </div>
          <div class="event-user">
            <i class="pi pi-user"></i>
            <span>{{ item.user }}</span>
          </div>
          <div class="event-details" v-if="item.comment">
            <p v-if="item.comment" class="event-comment">{{ item.comment }}</p>
          </div>
        </div>
      </template>
    </Timeline>

    <!-- Context Section -->
    <div class="context-section">
      <h4 class="context-title">Test Context</h4>
      <div class="context-grid">
        <div class="context-item">
          <span class="context-label">Test Run ID</span>
          <span class="context-value">#{{ result.test_run_id }}</span>
        </div>
        <div class="context-item">
          <span class="context-label">Test Case ID</span>
          <span class="context-value">#{{ result.test_case_id }}</span>
        </div>
        <div class="context-item" v-if="result.attachments?.length">
          <span class="context-label">Attachments</span>
          <span class="context-value"
            >{{ result.attachments.length }} file(s)</span
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-history {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  color: var(--text-color-secondary);
  text-align: center;
}

.empty-history i {
  font-size: 2.5rem;
  color: var(--surface-400);
  margin-bottom: 12px;
}

.empty-history p {
  margin: 0;
  font-size: 0.875rem;
}

.history-timeline {
  padding: 0;
}

.timeline-marker {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--surface-card);
  box-shadow: 0 0 0 2px var(--surface-border);
}

.timeline-event {
  padding: 12px 16px;
  background-color: var(--surface-hover);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  margin-bottom: 8px;
}

.event-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.event-date {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  margin-left: auto;
}

.event-repeat {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--surface-200);
  color: var(--text-color-secondary);
}

.event-user {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  margin-bottom: 8px;
}

.event-user i {
  font-size: 0.75rem;
}

.event-details {
  padding-top: 8px;
  border-top: 1px solid var(--surface-border);
}

.event-message {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--red-600, #dc2626);
  margin: 0 0 4px 0;
  word-break: break-word;
}

.event-comment {
  font-size: 0.8rem;
  color: var(--text-color);
  margin: 0;
  font-style: italic;
}

.context-section {
  padding: 16px;
  background-color: var(--surface-hover);
  border-radius: 8px;
}

.context-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 12px 0;
}

.context-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.context-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.context-label {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.context-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color);
}
</style>
