<script setup lang="ts">
import { computed, toRef } from "vue";
import type { TestSuite, TestSuiteTree } from "@/types/testSuite";
import Button from "primevue/button";
import { useAuthStore } from "@/stores/auth";
import { useTreeDnd } from "@/composables/useTreeDnd";

const authStore = useAuthStore();

const props = withDefaults(
  defineProps<{
    suites: TestSuiteTree[];
    selectedSuiteId?: number | null;
    expandedIds: Set<number>;
    root?: boolean;
  }>(),
  { root: true },
);

const emit = defineEmits<{
  (e: "select", suiteId: number | null): void;
  (e: "toggle", suiteId: number): void;
  (e: "add-suite", parentId: number | null): void;
  (e: "delete-suite", suite: TestSuite): void;
  (e: "reorder-suite", id: number, newDisplayOrder: number): void;
}>();

// Each recursive instance owns the DnD scope for its own level. Drag handlers
// are attached only to this level's rows (`props.suites`); child levels mount
// their own `TestSuiteTree` and register independently. Same-parent drops are
// naturally enforced because every suite at one level shares `parent_suite_id`.
const dndSiblings = computed(() => props.suites as TestSuite[]);

const dnd = useTreeDnd<TestSuite>({
  items: toRef(dndSiblings, "value"),
  scopeKey: (s) => s.parent_suite_id ?? -1,
  onReorder: (id, newOrder) => emit("reorder-suite", id, newOrder),
});

function handleSelect(suiteId: number | null) {
  emit("select", suiteId);
}

function handleToggle(suiteId: number, event: Event) {
  event.stopPropagation();
  emit("toggle", suiteId);
}

function isExpanded(suiteId: number): boolean {
  return props.expandedIds.has(suiteId);
}

function hasChildren(suite: TestSuiteTree): boolean {
  return suite.children && suite.children.length > 0;
}

function handleKeyDown(event: KeyboardEvent, suiteId: number | null) {
  const el = event.currentTarget as HTMLElement;
  // Find the root tree container (nearest ancestor with data-keyboard-nav-tree,
  // or fall back to the nearest .suite-tree-container)
  const container =
    el.closest("[data-keyboard-nav-tree]") ??
    el.closest(".suite-tree-container");
  if (!container) return;

  const allItems = Array.from(
    container.querySelectorAll("[data-tree-item]"),
  ) as HTMLElement[];
  const currentIndex = allItems.indexOf(el);

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault();
      if (currentIndex < allItems.length - 1) {
        allItems[currentIndex + 1].focus();
      }
      break;
    case "ArrowUp":
      event.preventDefault();
      if (currentIndex > 0) {
        allItems[currentIndex - 1].focus();
      }
      break;
    case "ArrowRight":
      event.preventDefault();
      if (suiteId !== null) emit("toggle", suiteId);
      break;
    case "ArrowLeft":
      event.preventDefault();
      if (suiteId !== null) emit("toggle", suiteId);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      emit("select", suiteId);
      break;
  }
}
</script>

<template>
  <div class="test-suite-tree">
    <!-- All Suites option (only at root) -->
    <div
      v-if="props.root"
      class="tree-item all-suites"
      :class="{ selected: selectedSuiteId === null }"
      tabindex="0"
      data-tree-item
      @click="handleSelect(null)"
      @keydown="handleKeyDown($event, null)"
    >
      <i class="pi pi-folder"></i>
      <span class="item-label">All Test Cases</span>
    </div>

    <!-- Recursive tree rendering -->
    <template v-for="suite in suites" :key="suite.id">
      <div
        class="tree-item"
        :class="{
          selected: selectedSuiteId === suite.id,
          'has-children': hasChildren(suite),
          'is-dragging': dnd.draggedId.value === suite.id,
          'drop-indicator-top': dnd.dropIndicatorFor(suite) === 'top',
          'drop-indicator-bottom': dnd.dropIndicatorFor(suite) === 'bottom',
        }"
        :style="{ paddingLeft: `${(suite.level || 0) * 16 + 8}px` }"
        tabindex="0"
        data-tree-item
        :draggable="authStore.canManageTests"
        @click="handleSelect(suite.id)"
        @keydown="handleKeyDown($event, suite.id)"
        @dragstart="dnd.onDragStart($event, suite)"
        @dragover="dnd.onDragOver($event, suite)"
        @dragleave="dnd.onDragLeave(suite)"
        @drop="dnd.onDrop($event, suite)"
        @dragend="dnd.onDragEnd"
      >
        <button
          v-if="hasChildren(suite)"
          class="expand-btn"
          @click="handleToggle(suite.id, $event)"
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

        <i class="pi pi-folder folder-icon"></i>
        <span class="item-label">{{ suite.name }}</span>
        <span v-if="suite.test_case_count" class="item-count">{{
          suite.test_case_count
        }}</span>
        <Button
          v-if="authStore.canManageTests"
          icon="pi pi-trash"
          text
          rounded
          size="small"
          severity="danger"
          class="suite-delete-btn"
          aria-label="Delete suite"
          @click.stop="emit('delete-suite', suite)"
        />
      </div>

      <!-- Render children if expanded -->
      <template v-if="hasChildren(suite) && isExpanded(suite.id)">
        <TestSuiteTree
          :suites="suite.children"
          :selectedSuiteId="selectedSuiteId"
          :expandedIds="expandedIds"
          :root="false"
          @select="handleSelect"
          @toggle="(id) => emit('toggle', id)"
          @add-suite="(parentId) => emit('add-suite', parentId)"
          @delete-suite="(s) => emit('delete-suite', s)"
          @reorder-suite="(id, order) => emit('reorder-suite', id, order)"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.test-suite-tree {
  display: flex;
  flex-direction: column;
}

.tree-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  margin: 1px 4px;
  font-size: 0.875rem;
  color: var(--text-color);
  transition: background-color 0.15s ease;
}

.tree-item[draggable="true"] {
  cursor: grab;
}

.tree-item.is-dragging {
  opacity: 0.45;
}

.tree-item.drop-indicator-top::before,
.tree-item.drop-indicator-bottom::after {
  content: "";
  position: absolute;
  left: 4px;
  right: 4px;
  height: 2px;
  background-color: var(--primary-color);
  pointer-events: none;
}

.tree-item.drop-indicator-top::before {
  top: 0;
}

.tree-item.drop-indicator-bottom::after {
  bottom: 0;
}

.tree-item:hover {
  background-color: var(--surface-hover);
}

.tree-item.selected {
  background-color: var(--highlight-bg);
  color: var(--primary-color);
}

.tree-item.all-suites {
  font-weight: 600;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--surface-border);
  border-radius: 0;
  padding-bottom: 12px;
  margin-bottom: 8px;
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

.item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  background-color: var(--surface-200);
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.tree-item.selected .item-count {
  background-color: var(--primary-color);
  color: var(--primary-color-text);
}

.suite-delete-btn {
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.tree-item:hover .suite-delete-btn,
.tree-item:focus-within .suite-delete-btn {
  opacity: 1;
}
</style>
