<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { TestCase } from "@/types/testCase";
import type { TestSuiteTree } from "@/types/testSuite";
import Checkbox from "primevue/checkbox";
import Tag from "primevue/tag";
import {
  computeSuiteState,
  toggleSuite,
  toggleCase,
} from "@/composables/useSuiteSelection";
import { getPrioritySeverity, PRIORITY_LABELS } from "@/types/testCase";

const props = defineProps<{
  suites: TestSuiteTree[];
  casesBySuite: Record<number, TestCase[]>;
  selectedCaseIds: Set<number>;
  selectedSuiteIds: Set<number>;
  loadingSuiteIds?: Set<number>;
}>();

const emit = defineEmits<{
  (e: "update:selectedCaseIds", ids: Set<number>): void;
  (e: "update:selectedSuiteIds", ids: Set<number>): void;
  (e: "expand-suite", suiteId: number): void;
}>();

const expandedSuiteIds = ref<Set<number>>(new Set());

watch(
  () => props.suites,
  (suites) => {
    if (suites.length && expandedSuiteIds.value.size === 0) {
      suites.forEach((s) => expandedSuiteIds.value.add(s.id));
    }
  },
  { immediate: true },
);

function isExpanded(suiteId: number): boolean {
  return expandedSuiteIds.value.has(suiteId);
}

function toggleExpand(suiteId: number) {
  const next = new Set(expandedSuiteIds.value);
  if (next.has(suiteId)) {
    next.delete(suiteId);
  } else {
    next.add(suiteId);
    emit("expand-suite", suiteId);
  }
  expandedSuiteIds.value = next;
}

function getSuiteState(
  suite: TestSuiteTree,
): "checked" | "unchecked" | "indeterminate" {
  return computeSuiteState(
    suite,
    props.selectedCaseIds,
    props.casesBySuite,
    props.selectedSuiteIds,
  );
}

function handleSuiteToggle(suite: TestSuiteTree) {
  const { caseIds, suiteIds } = toggleSuite(
    suite,
    props.selectedCaseIds,
    props.casesBySuite,
    props.selectedSuiteIds,
  );
  emit("update:selectedCaseIds", caseIds);
  emit("update:selectedSuiteIds", suiteIds);
}

function handleCaseToggle(caseId: number) {
  const newIds = toggleCase(caseId, props.selectedCaseIds);
  emit("update:selectedCaseIds", newIds);
}

const casesForSuite = computed(() => {
  return (suiteId: number) => props.casesBySuite[suiteId] || [];
});

function isLoading(suiteId: number): boolean {
  return props.loadingSuiteIds?.has(suiteId) ?? false;
}
</script>

<template>
  <div class="suite-tree-selector">
    <template v-for="suite in suites" :key="suite.id">
      <div
        class="suite-row"
        :style="{ paddingLeft: `${(suite.level || 0) * 20 + 4}px` }"
      >
        <button
          v-if="suite.children.length"
          class="expand-btn"
          @click="toggleExpand(suite.id)"
          :aria-label="isExpanded(suite.id) ? 'Collapse' : 'Expand'"
        >
          <i
            :class="
              isExpanded(suite.id)
                ? 'pi pi-chevron-down'
                : 'pi pi-chevron-right'
            "
          ></i>
        </button>
        <span v-else class="expand-placeholder"></span>

        <Checkbox
          :modelValue="getSuiteState(suite) === 'checked'"
          :indeterminate="getSuiteState(suite) === 'indeterminate'"
          :binary="true"
          @update:modelValue="handleSuiteToggle(suite)"
        />
        <i class="pi pi-folder folder-icon"></i>
        <span class="suite-label" @click="toggleExpand(suite.id)">{{
          suite.name
        }}</span>
      </div>

      <template v-if="isExpanded(suite.id)">
        <!-- Loading state -->
        <div
          v-if="isLoading(suite.id)"
          class="case-loading"
          :style="{ paddingLeft: `${(suite.level || 0) * 20 + 44}px` }"
        >
          <i class="pi pi-spin pi-spinner"></i>
          <span>Loading...</span>
        </div>

        <!-- Cases under this suite -->
        <div
          v-for="tc in casesForSuite(suite.id)"
          :key="tc.id"
          class="case-row"
          :style="{ paddingLeft: `${(suite.level || 0) * 20 + 44}px` }"
        >
          <Checkbox
            :modelValue="selectedCaseIds.has(tc.id)"
            :binary="true"
            @update:modelValue="handleCaseToggle(tc.id)"
          />
          <span class="case-title">{{ tc.title }}</span>
          <Tag
            :value="
              PRIORITY_LABELS[tc.priority as keyof typeof PRIORITY_LABELS] ||
              tc.priority
            "
            :severity="getPrioritySeverity(tc.priority)"
            class="case-priority"
          />
        </div>

        <!-- Recurse children -->
        <TestSuiteTreeSelector
          v-if="suite.children.length"
          :suites="suite.children"
          :casesBySuite="casesBySuite"
          :selectedCaseIds="selectedCaseIds"
          :selectedSuiteIds="selectedSuiteIds"
          :loadingSuiteIds="loadingSuiteIds"
          @update:selectedCaseIds="
            (ids: Set<number>) => emit('update:selectedCaseIds', ids)
          "
          @update:selectedSuiteIds="
            (ids: Set<number>) => emit('update:selectedSuiteIds', ids)
          "
          @expand-suite="(id: number) => emit('expand-suite', id)"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.suite-tree-selector {
  display: flex;
  flex-direction: column;
}

.suite-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
}

.suite-row:hover {
  background-color: var(--surface-hover);
}

.case-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 4px;
}

.case-row:hover {
  background-color: var(--surface-hover);
}

.case-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  color: var(--text-color-secondary);
  font-size: 0.85rem;
}

.expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  border-radius: 3px;
  flex-shrink: 0;
}

.expand-btn:hover {
  background-color: var(--surface-200);
  color: var(--text-color);
}

.expand-btn i {
  font-size: 0.7rem;
}

.expand-placeholder {
  width: 18px;
  flex-shrink: 0;
}

.folder-icon {
  color: var(--yellow-500);
  font-size: 0.9rem;
  flex-shrink: 0;
}

.suite-label {
  flex: 1;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-title {
  flex: 1;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-priority {
  flex-shrink: 0;
}
</style>
