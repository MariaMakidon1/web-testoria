<script setup lang="ts">
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import type { PerProjectAnalyticsRow } from "@/types/report";
import { formatPassRate } from "@/utils/passRate";

defineProps<{
  rows: PerProjectAnalyticsRow[];
}>();

const emit = defineEmits<{
  (e: "select", projectId: number): void;
}>();

function onRowClick(event: { data: PerProjectAnalyticsRow }) {
  emit("select", event.data.project_id);
}
</script>

<template>
  <div class="per-project-breakdown">
    <h3 class="panel-title">Per-project breakdown</h3>
    <DataTable
      :value="rows"
      data-key="project_id"
      :row-hover="true"
      striped-rows
      class="breakdown-table"
      @row-click="onRowClick"
    >
      <Column field="project_name" header="Project">
        <template #body="{ data }">
          <span class="project-name">{{ data.project_name }}</span>
          <span v-if="data.is_archived" class="archived-tag">archived</span>
        </template>
      </Column>
      <Column field="total_test_runs" header="Runs" />
      <Column field="completed_runs" header="Completed" />
      <Column field="total_results" header="Results" />
      <Column field="overall_pass_rate" header="Pass rate">
        <template #body="{ data }">
          <span class="pass-rate-value">
            {{ formatPassRate(data.overall_pass_rate) }}
          </span>
        </template>
      </Column>
    </DataTable>
    <p v-if="!rows.length" class="empty-hint">
      No projects in scope.
    </p>
  </div>
</template>

<style scoped>
.per-project-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.panel-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.breakdown-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.project-name {
  font-weight: 500;
}

.archived-tag {
  margin-left: 0.5rem;
  padding: 0 0.4rem;
  font-size: 0.7rem;
  border-radius: 4px;
  background: var(--surface-200, #e2e8f0);
  color: var(--text-color-secondary, #64748b);
}

.pass-rate-value {
  color: var(--status-passed, #22c55e);
  font-weight: 600;
}

.empty-hint {
  color: var(--text-color-secondary, #64748b);
  font-size: 0.875rem;
}
</style>
