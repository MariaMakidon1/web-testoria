<script setup lang="ts">
import type { TestCaseWithResult } from "@/types/testRun";
import type { TestResult, ResultStatus } from "@/types/testResult";
import StatusBadge from "@/components/common/StatusBadge.vue";
import Tag from "primevue/tag";

export interface SuiteTreeNode {
  id: number | null;
  name: string;
  items: TestCaseWithResult[];
  children: SuiteTreeNode[];
  totalCount: number;
  passed: number;
  failed: number;
  blocked: number;
  no_run: number;
}

const props = defineProps<{
  node: SuiteTreeNode;
  level: number;
  mode: "read" | "execute";
  selectedCaseId?: number | null;
  selectedResult?: TestResult | null;
  isCollapsed: (id: number | null) => boolean;
  toggle: (id: number | null) => void;
  getResultFor: (caseId: number) => TestResult | null;
  getStatusFor: (caseId: number) => ResultStatus;
  statusColor: (status: ResultStatus) => string;
  statusIcon: (status: ResultStatus) => string;
}>();

const emit = defineEmits<{
  (e: "select", caseId: number): void;
}>();

function isExecuted(caseId: number): boolean {
  const r = props.getResultFor(caseId);
  return r?.id != null;
}

function isSelected(caseId: number): boolean {
  if (props.mode === "execute") {
    return props.selectedCaseId === caseId;
  }
  // read mode: prefer selectedResult's test_case_id, fallback to selectedCaseId
  return (
    props.selectedResult?.test_case_id === caseId ||
    props.selectedCaseId === caseId
  );
}

</script>

<template>
  <div class="suite-branch" :style="{ paddingLeft: `${level * 12}px` }">
    <button
      type="button"
      class="suite-branch-header"
      :aria-expanded="!isCollapsed(node.id)"
      @click="toggle(node.id)"
    >
      <i
        class="pi"
        :class="isCollapsed(node.id) ? 'pi-chevron-right' : 'pi-chevron-down'"
      />
      <span class="suite-branch-name">{{ node.name }}</span>
      <span class="suite-branch-progress" v-if="node.totalCount > 0">
        <span
          v-if="node.passed"
          class="seg-count seg-passed"
          :title="`${node.passed} passed`"
        >{{ node.passed }}</span>
        <span
          v-if="node.failed"
          class="seg-count seg-failed"
          :title="`${node.failed} failed`"
        >{{ node.failed }}</span>
        <span
          v-if="node.blocked"
          class="seg-count seg-blocked"
          :title="`${node.blocked} blocked`"
        >{{ node.blocked }}</span>
        <span
          v-if="node.no_run"
          class="seg-count seg-no-run"
          :title="`${node.no_run} not run`"
        >{{ node.no_run }}</span>
      </span>
      <span class="suite-branch-count">{{ node.totalCount }}</span>
    </button>

    <div v-if="!isCollapsed(node.id)" class="suite-branch-body">
      <!-- Read mode rows -->
      <template v-if="mode === 'read'">
        <div
          v-for="tc in node.items"
          :key="tc.id"
          class="result-row"
          :class="{ selected: isSelected(tc.id) }"
          data-testid="suite-tree-result-row"
          @click="emit('select', tc.id)"
        >
          <div
            class="status-dot"
            :style="{ backgroundColor: statusColor(getStatusFor(tc.id)) }"
          />
          <div class="row-body">
            <div class="row-title-line">
              <span class="case-id">T{{ tc.id }}</span>
              <span class="case-title">{{ tc.title }}</span>
            </div>
            <div class="row-meta">
              <StatusBadge
                :value="getStatusFor(tc.id)"
                type="result"
                size="small"
              />
              <StatusBadge
                v-if="tc.priority"
                :value="tc.priority"
                type="priority"
                size="small"
              />
              <span v-if="!isExecuted(tc.id)" class="not-run-hint">
                Not yet run
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- Execute mode rows -->
      <template v-else>
        <div
          v-for="tc in node.items"
          :key="tc.id"
          class="case-row"
          data-testid="execution-test-case-item"
          :class="{ selected: isSelected(tc.id) }"
          @click="emit('select', tc.id)"
        >
          <div
            class="status-indicator"
            :style="{ backgroundColor: statusColor(getStatusFor(tc.id)) }"
          >
            <i :class="statusIcon(getStatusFor(tc.id))"></i>
          </div>
          <div class="case-info">
            <div class="case-title-row">
              <span class="case-id">T{{ tc.id }}</span>
              <span class="case-title">{{ tc.title }}</span>
            </div>
            <div class="case-meta">
              <StatusBadge
                v-if="isExecuted(tc.id)"
                :value="getStatusFor(tc.id)"
                type="result"
                size="small"
              />
              <StatusBadge
                v-if="tc.priority"
                :value="tc.priority"
                type="priority"
                size="small"
              />
              <Tag
                v-if="tc.type"
                :value="tc.type"
                severity="secondary"
                class="type-tag"
              />
              <span
                v-if="tc.automation_id"
                class="automation-id"
                :title="'Automation ID: ' + tc.automation_id"
              >
                <i class="pi pi-cog"></i> {{ tc.automation_id }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <SuiteTreeBranch
        v-for="child in node.children"
        :key="child.id ?? 'unassigned'"
        :node="child"
        :level="level + 1"
        :mode="mode"
        :selected-case-id="selectedCaseId"
        :selected-result="selectedResult"
        :is-collapsed="isCollapsed"
        :toggle="toggle"
        :get-result-for="getResultFor"
        :get-status-for="getStatusFor"
        :status-color="statusColor"
        :status-icon="statusIcon"
        @select="(id) => emit('select', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.suite-branch {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 4px;
}

.suite-branch-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: var(--surface-section);
  border: 1px solid var(--surface-border);
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-color);
  font-size: 0.8rem;
  font-weight: 600;
  width: 100%;
  text-align: left;
}

.suite-branch-header:hover {
  background: var(--surface-hover);
}

.suite-branch-header .pi {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

.suite-branch-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.suite-branch-progress {
  display: inline-flex;
  gap: 4px;
  font-size: 0.65rem;
  font-weight: 700;
}

.seg-count {
  padding: 0 6px;
  border-radius: 8px;
  color: #fff;
  line-height: 1.4;
}

.seg-passed {
  background: var(--status-passed);
}

.seg-failed {
  background: var(--status-failed);
}

.seg-blocked {
  background: var(--status-blocked);
}

.seg-no-run {
  background: var(--status-no-run);
  color: var(--text-color);
}

.suite-branch-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  background: var(--surface-200);
  padding: 1px 6px;
  border-radius: 10px;
}

.suite-branch-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 8px;
}

/* Read mode rows (result-row) */
.result-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
  cursor: pointer;
  transition: background-color 0.15s;
}

.result-row:hover {
  background: var(--surface-hover);
}

.result-row.selected {
  border-color: var(--primary-500, #667eea);
  background: var(--highlight-bg);
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}

.row-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.row-title-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.row-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.not-run-hint {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  font-style: italic;
}

/* Execute mode rows (case-row) — compact, same as the old SuiteCaseSection */
.case-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
  cursor: pointer;
  transition: background-color 0.15s;
}

.case-row:hover {
  background: var(--surface-hover);
}

.case-row.selected {
  border-color: var(--primary-500, #667eea);
  background: var(--highlight-bg);
}

.status-indicator {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.status-indicator i {
  font-size: 0.75rem;
}

.case-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.case-title-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.case-id {
  font-family: monospace;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primary-600, #5a6fd6);
  background: var(--highlight-bg);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.case-title {
  font-size: 0.85rem;
  color: var(--text-color);
  font-weight: 500;
  line-height: 1.35;
  word-break: break-word;
}

.case-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.type-tag {
  font-size: 0.65rem;
  padding: 0.05rem 0.35rem;
}

.automation-id {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  font-family: monospace;
}

.automation-id i {
  font-size: 0.65rem;
}
</style>
