<script setup lang="ts">
import { ref, computed, watch, onMounted, toRef } from "vue";
import type { TestCase } from "@/types/testCase";
import type { TestSuite } from "@/types/testSuite";
import { PRIORITY_LABELS, getPrioritySeverity } from "@/types/testCase";
import Button from "primevue/button";
import Checkbox from "primevue/checkbox";
import Tag from "primevue/tag";
import { useAuthStore } from "@/stores/auth";
import { useTreeDnd } from "@/composables/useTreeDnd";

const authStore = useAuthStore();

const props = defineProps<{
  suite: TestSuite;
  testCases: TestCase[];
  selectedIds: Set<number>;
  level?: number;
  forceCollapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: "select-case", id: number): void;
  (e: "toggle-select", id: number): void;
  (e: "add-case", suiteId: number): void;
  (e: "add-subsection", parentId: number): void;
  (e: "edit-suite", suite: TestSuite): void;
  (e: "delete-suite", suite: TestSuite): void;
  (e: "delete-case", testCase: TestCase): void;
  (e: "reorder-case", id: number, suiteId: number, newDisplayOrder: number): void;
  (e: "expand-change", suiteId: number, expanded: boolean): void;
}>();

const dnd = useTreeDnd<TestCase>({
  items: toRef(props, "testCases"),
  scopeKey: (tc) => tc.suite_id,
  onReorder: (id, newOrder) => {
    emit("reorder-case", id, props.suite.id, newOrder);
  },
});

const isExpanded = ref(true);

// Watch for parent-controlled collapse/expand
watch(
  () => props.forceCollapsed,
  (collapsed) => {
    if (collapsed !== undefined) {
      isExpanded.value = !collapsed;
      emit("expand-change", props.suite.id, isExpanded.value);
    }
  },
);

// Emit initial state
onMounted(() => {
  emit("expand-change", props.suite.id, isExpanded.value);
});

const caseCount = computed(() => props.testCases.length);

const allSelected = computed(() => {
  if (props.testCases.length === 0) return false;
  return props.testCases.every((tc) => props.selectedIds.has(tc.id));
});

const someSelected = computed(() => {
  if (allSelected.value) return false;
  return props.testCases.some((tc) => props.selectedIds.has(tc.id));
});

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
  emit("expand-change", props.suite.id, isExpanded.value);
}

function toggleSelectAll() {
  props.testCases.forEach((tc) => {
    emit("toggle-select", tc.id);
  });
}

function handleCaseClick(testCase: TestCase) {
  emit("select-case", testCase.id);
}
</script>

<template>
  <div class="test-case-section" :class="{ collapsed: !isExpanded }">
    <!-- Section Header -->
    <div class="section-header" @click="toggleExpand">
      <button
        class="expand-toggle"
        :aria-label="isExpanded ? 'Collapse' : 'Expand'"
      >
        <i
          :class="isExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
        ></i>
      </button>

      <h3 class="section-title">{{ suite.name }}</h3>

      <span class="case-count">{{ caseCount }}</span>

      <Button
        v-if="authStore.isProjectManager"
        icon="pi pi-pencil"
        text
        rounded
        size="small"
        class="edit-btn"
        @click.stop="emit('edit-suite', suite)"
        aria-label="Edit section"
      />
      <Button
        v-if="authStore.canManageTests"
        icon="pi pi-trash"
        text
        rounded
        size="small"
        severity="danger"
        class="edit-btn"
        @click.stop="emit('delete-suite', suite)"
        aria-label="Delete section"
      />
    </div>

    <!-- Section Content -->
    <div v-if="isExpanded" class="section-content">
      <!-- Table Header -->
      <div class="table-header" v-if="testCases.length > 0">
        <div class="col-checkbox">
          <Checkbox
            :modelValue="allSelected"
            :indeterminate="someSelected"
            binary
            @click.stop="toggleSelectAll"
          />
        </div>
        <div class="col-id">ID</div>
        <div class="col-title">Title</div>
        <div class="col-priority">Priority</div>
        <div class="col-type">Type</div>
        <div class="col-automation">Status</div>
        <div v-if="authStore.canManageTests" class="col-actions"></div>
      </div>

      <!-- Test Cases List -->
      <div class="test-cases-list">
        <div
          v-for="testCase in testCases"
          :key="testCase.id"
          class="test-case-row"
          :class="{
            selected: selectedIds.has(testCase.id),
            'is-dragging': dnd.draggedId.value === testCase.id,
            'drop-indicator-top':
              dnd.dropIndicatorFor(testCase) === 'top',
            'drop-indicator-bottom':
              dnd.dropIndicatorFor(testCase) === 'bottom',
          }"
          :draggable="authStore.canManageTests"
          @click="handleCaseClick(testCase)"
          @dragstart="dnd.onDragStart($event, testCase)"
          @dragover="dnd.onDragOver($event, testCase)"
          @dragleave="dnd.onDragLeave(testCase)"
          @drop="dnd.onDrop($event, testCase)"
          @dragend="dnd.onDragEnd"
        >
          <div class="col-checkbox" @click.stop>
            <Checkbox
              :modelValue="selectedIds.has(testCase.id)"
              binary
              @click="emit('toggle-select', testCase.id)"
            />
          </div>
          <div class="col-id">
            <span class="case-id">C{{ testCase.id }}</span>
          </div>
          <div class="col-title">
            <span class="case-title">{{ testCase.title }}</span>
          </div>
          <div class="col-priority">
            <Tag
              :value="
                PRIORITY_LABELS[
                  testCase.priority as keyof typeof PRIORITY_LABELS
                ] || testCase.priority
              "
              :severity="getPrioritySeverity(testCase.priority)"
            />
          </div>
          <div class="col-type">
            <span class="type-badge">{{ testCase.type }}</span>
          </div>
          <div class="col-automation">
            <span class="automation-badge" :class="testCase.status">
              {{ testCase.status }}
            </span>
          </div>
          <div v-if="authStore.canManageTests" class="col-actions" @click.stop>
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              class="row-delete-btn"
              aria-label="Delete test case"
              @click.stop="emit('delete-case', testCase)"
            />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="testCases.length === 0" class="empty-section">
        <p>No test cases in this section</p>
      </div>

      <!-- Section Actions -->
      <div v-if="authStore.isProjectManager" class="section-actions">
        <Button
          label="Add Case"
          icon="pi pi-plus"
          text
          size="small"
          data-testid="section-add-case-btn"
          @click="emit('add-case', suite.id)"
        />
        <Button
          label="Add Subsection"
          icon="pi pi-plus"
          text
          size="small"
          data-testid="section-add-subsection-btn"
          @click="emit('add-subsection', suite.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-case-section {
  background-color: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  background-color: var(--surface-hover);
  border-bottom: 1px solid var(--surface-border);
  border-radius: 6px 6px 0 0;
}

.test-case-section.collapsed .section-header {
  border-bottom: none;
  border-radius: 6px;
}

.expand-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-color-secondary);
  border-radius: 4px;
}

.expand-toggle:hover {
  background-color: var(--surface-200);
}

.expand-toggle i {
  font-size: 0.8rem;
}

.section-title {
  flex: 1;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.case-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primary-color-text);
  background-color: var(--primary-color);
  padding: 2px 8px;
  border-radius: 10px;
}

.edit-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.section-header:hover .edit-btn {
  opacity: 1;
}

.section-content {
  padding: 0;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--surface-hover);
  border-bottom: 1px solid var(--surface-border);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
}

.test-cases-list {
  display: flex;
  flex-direction: column;
}

.test-case-row {
  position: relative;
  display: flex;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--surface-border);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.test-case-row[draggable="true"] {
  cursor: grab;
}

.test-case-row.is-dragging {
  opacity: 0.45;
}

.test-case-row.drop-indicator-top::before,
.test-case-row.drop-indicator-bottom::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background-color: var(--primary-color);
  pointer-events: none;
}

.test-case-row.drop-indicator-top::before {
  top: 0;
}

.test-case-row.drop-indicator-bottom::after {
  bottom: 0;
}

.test-case-row:last-child {
  border-bottom: none;
}

.test-case-row:hover {
  background-color: var(--surface-hover);
}

.test-case-row.selected {
  background-color: var(--surface-100);
}

.col-checkbox {
  width: 40px;
  flex-shrink: 0;
}

.col-id {
  width: 70px;
  flex-shrink: 0;
}

.col-title {
  flex: 1;
  min-width: 0;
}

.col-priority {
  width: 80px;
  flex-shrink: 0;
}

.col-type {
  width: 100px;
  flex-shrink: 0;
}

.col-automation {
  width: 100px;
  flex-shrink: 0;
}

.col-actions {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.row-delete-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.test-case-row:hover .row-delete-btn {
  opacity: 1;
}

.case-id {
  font-family: monospace;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--primary-color);
}

.case-title {
  font-size: 0.875rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  background-color: var(--surface-200);
  padding: 2px 8px;
  border-radius: 4px;
}

.automation-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
}

.automation-badge.manual {
  background-color: var(--surface-200);
  color: var(--text-color-secondary);
}

.automation-badge.automated {
  background-color: rgba(34, 197, 94, 0.2);
  color: var(--green-400);
}

.automation-badge.to-automate {
  background-color: rgba(234, 179, 8, 0.2);
  color: var(--yellow-400);
}

.empty-section {
  padding: 24px;
  text-align: center;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--surface-border);
  background-color: var(--surface-hover);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .section-header {
    padding: 10px 12px;
  }

  .section-title {
    font-size: 0.9rem;
  }

  .case-count {
    font-size: 0.7rem;
    padding: 2px 6px;
  }

  .edit-btn {
    opacity: 1;
  }

  .table-header {
    padding: 6px 12px;
    font-size: 0.65rem;
  }

  .test-case-row {
    padding: 8px 12px;
  }

  .col-checkbox {
    width: 32px;
  }

  .col-id {
    width: 50px;
  }

  .col-priority {
    width: 60px;
  }

  /* Hide type and automation columns on mobile */
  .col-type,
  .col-automation {
    display: none;
  }

  .case-id {
    font-size: 0.7rem;
  }

  .case-title {
    font-size: 0.8rem;
  }

  .section-actions {
    padding: 10px 12px;
  }
}

@media (max-width: 480px) {
  .section-header {
    padding: 8px 10px;
    gap: 6px;
  }

  .section-title {
    font-size: 0.85rem;
  }

  .table-header {
    display: none;
  }

  .test-case-row {
    padding: 10px;
    flex-wrap: wrap;
    gap: 6px;
  }

  .col-checkbox {
    width: 28px;
    order: 1;
  }

  .col-id {
    width: auto;
    order: 2;
  }

  .col-priority {
    width: auto;
    order: 3;
    margin-left: auto;
  }

  .col-title {
    width: 100%;
    order: 4;
    padding-left: 28px;
    margin-top: -4px;
  }

  .case-title {
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .section-actions {
    flex-wrap: wrap;
    gap: 6px;
  }
}
</style>
