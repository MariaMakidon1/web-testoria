<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import type { TestCase } from "@/types/testCase";
import type { TestSuite, TestSuiteTree } from "@/types/testSuite";
import TestSuiteTreeComponent from "./TestSuiteTree.vue";
import TestCaseSection from "./TestCaseSection.vue";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";

const uiStore = useUIStore();
const authStore = useAuthStore();

const props = defineProps<{
  suiteTree: TestSuiteTree[];
  testCases: TestCase[];
  loading?: boolean;
}>();

// Mobile state
const MOBILE_BREAKPOINT = 768;
const isMobile = ref(false);
const suitePanelVisible = ref(true);

function checkMobile() {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
  // Auto-hide panel on mobile
  if (isMobile.value) {
    suitePanelVisible.value = false;
  } else {
    suitePanelVisible.value = true;
  }
}

function toggleSuitePanel() {
  suitePanelVisible.value = !suitePanelVisible.value;
}

function closeSuitePanelOnMobile() {
  if (isMobile.value) {
    suitePanelVisible.value = false;
  }
}

onMounted(() => {
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
  if (isMobile.value) {
    suitePanelVisible.value = false;
  }
  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});

const emit = defineEmits<{
  (e: "select-case", id: number): void;
  (e: "add-case", suiteId: number | null): void;
  (e: "add-suite", parentId: number | null): void;
  (e: "edit-suite", suite: TestSuite): void;
  (e: "delete-suite", suite: TestSuite): void;
  (e: "delete-case", testCase: TestCase): void;
  (e: "reorder-suite", id: number, newDisplayOrder: number): void;
  (e: "reorder-case", id: number, suiteId: number, newDisplayOrder: number): void;
}>();

// State
const selectedSuiteId = ref<number | null>(null);

// Derive Set<number> from persisted UI store state
const expandedSuiteIds = computed<Set<number>>(() => {
  const set = new Set<number>();
  for (const [id, expanded] of Object.entries(uiStore.suiteExpandedState)) {
    if (expanded) set.add(Number(id));
  }
  return set;
});
const selectedCaseIds = ref<Set<number>>(new Set());
const searchQuery = ref("");
const collapseAll = ref<boolean | undefined>(undefined);
const sectionExpandedStates = ref<Record<number, boolean>>({});

// Computed to determine if all sections are collapsed or expanded
const allSectionsCollapsed = computed(() => {
  const states = Object.values(sectionExpandedStates.value);
  if (states.length === 0) return false;
  return states.every((v) => !v);
});

const collapseButtonLabel = computed(() => {
  return allSectionsCollapsed.value ? "Expand All" : "Collapse All";
});

// Build a flat map of suites for easy lookup
const suiteMap = computed(() => {
  const map = new Map<number, TestSuite>();
  function addToMap(suites: TestSuiteTree[]) {
    for (const suite of suites) {
      map.set(suite.id, suite);
      if (suite.children?.length) {
        addToMap(suite.children);
      }
    }
  }
  addToMap(props.suiteTree);
  return map;
});

// Get all suite IDs including children recursively
function getSuiteAndChildIds(suiteId: number): Set<number> {
  const ids = new Set<number>([suiteId]);
  const suite = suiteMap.value.get(suiteId);
  if (suite) {
    function addChildIds(s: TestSuiteTree) {
      if (s.children) {
        for (const child of s.children) {
          ids.add(child.id);
          addChildIds(child);
        }
      }
    }
    addChildIds(suite as TestSuiteTree);
  }
  return ids;
}

// Walk the tree once to find the parent id of a suite (or null if top-level).
function getParentSuiteId(
  suiteId: number,
  tree: TestSuiteTree[],
  parentId: number | null = null,
): number | null {
  for (const node of tree) {
    if (node.id === suiteId) return parentId;
    if (node.children?.length) {
      const found = getParentSuiteId(suiteId, node.children, node.id);
      if (found !== null) return found;
    }
  }
  return null;
}

// Selecting a child suite expands the scope to the parent + all of the
// parent's descendants (including the selected suite and its siblings).
// Top-level selections stay as they are (no parent to promote to).
const effectiveScopeSuiteId = computed<number | null>(() => {
  if (selectedSuiteId.value === null) return null;
  const parent = getParentSuiteId(selectedSuiteId.value, props.suiteTree);
  return parent ?? selectedSuiteId.value;
});

// Filter test cases based on selected suite and search
const filteredTestCases = computed(() => {
  let cases = [...props.testCases];

  // Filter by suite (including child suites)
  if (effectiveScopeSuiteId.value !== null) {
    const suiteIds = getSuiteAndChildIds(effectiveScopeSuiteId.value);
    cases = cases.filter((tc) => suiteIds.has(tc.suite_id));
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    cases = cases.filter(
      (tc) =>
        tc.title.toLowerCase().includes(query) || String(tc.id).includes(query),
    );
  }

  return cases;
});

// Group test cases by suite for sections display. Each group is sorted by
// (display_order NULLS LAST, id) — matches the backend's `apply_case_order`
// so drag-and-drop reorders surface immediately while preserving the legacy
// "no explicit order yet" tail.
const testCasesBySuite = computed(() => {
  const grouped = new Map<number, TestCase[]>();

  for (const tc of filteredTestCases.value) {
    if (!grouped.has(tc.suite_id)) {
      grouped.set(tc.suite_id, []);
    }
    grouped.get(tc.suite_id)!.push(tc);
  }

  for (const arr of grouped.values()) {
    arr.sort((a, b) => {
      const ao = a.display_order;
      const bo = b.display_order;
      if (ao == null && bo == null) return a.id - b.id;
      if (ao == null) return 1;
      if (bo == null) return -1;
      if (ao !== bo) return ao - bo;
      return a.id - b.id;
    });
  }

  return grouped;
});

// TES-73: surface "Add Section" as the primary CTA when the project has no
// suites yet — a test case can't be created without one to attach it to.
const hasAnySuites = computed(() => props.suiteTree.length > 0);

// DFS flatten the suite tree in backend order so the cases-panel matches the
// aside suite-panel, and every suite gets a section (including empty ones).
const flattenedSuites = computed(() => {
  const out: TestSuite[] = [];
  function walk(nodes: TestSuiteTree[]) {
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(props.suiteTree);
  return out;
});

const visibleSuites = computed(() => {
  if (searchQuery.value.trim()) {
    const withCases = new Set(testCasesBySuite.value.keys());
    return flattenedSuites.value.filter((s) => withCases.has(s.id));
  }
  if (effectiveScopeSuiteId.value !== null) {
    const scopeIds = getSuiteAndChildIds(effectiveScopeSuiteId.value);
    return flattenedSuites.value.filter((s) => scopeIds.has(s.id));
  }
  return flattenedSuites.value;
});

// Handlers
function handleSuiteSelect(suiteId: number | null) {
  selectedSuiteId.value = suiteId;
  closeSuitePanelOnMobile();
}

function handleSuiteToggle(suiteId: number) {
  uiStore.toggleSuiteExpand(suiteId);
}

function handleCaseSelect(caseId: number) {
  emit("select-case", caseId);
}

function handleCaseToggleSelect(caseId: number) {
  if (selectedCaseIds.value.has(caseId)) {
    selectedCaseIds.value.delete(caseId);
  } else {
    selectedCaseIds.value.add(caseId);
  }
  selectedCaseIds.value = new Set(selectedCaseIds.value);
}

function handleAddCase(suiteId: number) {
  emit("add-case", suiteId);
}

function handleAddSubsection(parentId: number) {
  emit("add-suite", parentId);
}

function handleEditSuite(suite: TestSuite) {
  emit("edit-suite", suite);
}

function handleDeleteSuite(suite: TestSuite) {
  emit("delete-suite", suite);
}

function handleDeleteCase(testCase: TestCase) {
  emit("delete-case", testCase);
}

function handleAddRootSuite() {
  emit("add-suite", null);
}

function toggleCollapseAll() {
  // If all are collapsed, expand all; otherwise collapse all
  const shouldExpand = allSectionsCollapsed.value;
  collapseAll.value = !shouldExpand;

  // Update all section states
  const newStates: Record<number, boolean> = {};
  for (const key of Object.keys(sectionExpandedStates.value)) {
    newStates[Number(key)] = shouldExpand;
  }
  sectionExpandedStates.value = newStates;
}

function handleSectionExpandChange(suiteId: number, expanded: boolean) {
  sectionExpandedStates.value = {
    ...sectionExpandedStates.value,
    [suiteId]: expanded,
  };
  // Reset collapseAll so next button click always triggers a change
  collapseAll.value = undefined;
}

// Initialize expanded state - expand first level by default (only if no persisted state)
watch(
  () => props.suiteTree,
  (tree) => {
    if (tree.length && Object.keys(uiStore.suiteExpandedState).length === 0) {
      tree.forEach((suite) => uiStore.setSuiteExpanded(suite.id, true));
    }
  },
  { immediate: true },
);

// Initialize section states when visible suites change
watch(
  visibleSuites,
  (suites) => {
    const newStates: Record<number, boolean> = {};
    const visibleIds = new Set(suites.map((s) => s.id));

    // Keep existing states for visible suites
    for (const [key, value] of Object.entries(sectionExpandedStates.value)) {
      const numKey = Number(key);
      if (visibleIds.has(numKey)) {
        newStates[numKey] = value;
      }
    }

    // Add new suites — empty suites default collapsed, populated expanded
    suites.forEach((suite) => {
      if (!(suite.id in newStates)) {
        const hasCases = (testCasesBySuite.value.get(suite.id)?.length ?? 0) > 0;
        newStates[suite.id] = hasCases;
      }
    });

    sectionExpandedStates.value = newStates;
  },
  { immediate: true },
);
</script>

<template>
  <div class="test-case-tree-view">
    <!-- Mobile overlay -->
    <div
      v-if="isMobile && suitePanelVisible"
      class="suite-panel-overlay"
      @click="closeSuitePanelOnMobile"
    ></div>

    <!-- Left Panel: Suite Tree -->
    <aside
      class="suite-panel"
      :class="{
        'mobile-visible': suitePanelVisible,
        'mobile-hidden': isMobile && !suitePanelVisible,
      }"
    >
      <div class="panel-header">
        <h2>Test Cases</h2>
        <div class="panel-header-actions">
          <Button
            v-if="authStore.isProjectManager"
            label="Add Section"
            icon="pi pi-plus"
            size="small"
            data-testid="add-section-btn"
            @click="handleAddRootSuite"
            aria-label="Add section"
          />
          <Button
            v-if="isMobile"
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="closeSuitePanelOnMobile"
            aria-label="Close panel"
          />
        </div>
      </div>

      <div class="suite-tree-container">
        <TestSuiteTreeComponent
          data-keyboard-nav-tree
          :suites="suiteTree"
          :selectedSuiteId="selectedSuiteId"
          :expandedIds="expandedSuiteIds"
          @select="handleSuiteSelect"
          @toggle="handleSuiteToggle"
          @add-suite="(parentId) => emit('add-suite', parentId)"
          @delete-suite="handleDeleteSuite"
          @reorder-suite="(id, order) => emit('reorder-suite', id, order)"
        />
      </div>
    </aside>

    <!-- Right Panel: Test Cases by Section -->
    <main class="cases-panel">
      <!-- Toolbar -->
      <div class="panel-toolbar">
        <div class="toolbar-left">
          <Button
            v-if="isMobile"
            icon="pi pi-bars"
            text
            rounded
            size="small"
            @click="toggleSuitePanel"
            aria-label="Toggle sections panel"
            class="mobile-menu-btn"
          />
          <span class="p-input-icon-left search-input">
            <i class="pi pi-search" />
            <InputText
              v-model="searchQuery"
              placeholder="Search test cases..."
            />
          </span>
        </div>

        <div class="toolbar-right">
          <Button
            :label="collapseButtonLabel"
            text
            size="small"
            @click="toggleCollapseAll"
          />

          <Button
            v-if="authStore.isProjectManager"
            label="Add Test Case"
            icon="pi pi-plus"
            size="small"
            @click="emit('add-case', selectedSuiteId)"
          />
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <span>
          Contains <strong>{{ visibleSuites.length }}</strong> sections and
          <strong>{{ filteredTestCases.length }}</strong> cases
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Loading test cases...</span>
      </div>

      <!-- Content -->
      <div v-else class="sections-container">
        <!-- Empty State -->
        <div v-if="visibleSuites.length === 0" class="empty-state">
          <i class="pi pi-inbox"></i>
          <p v-if="searchQuery">No test cases match your search</p>
          <p v-else-if="selectedSuiteId !== null">
            No test cases in this section
          </p>
          <p v-else-if="!hasAnySuites">No sections yet</p>
          <p v-else>No test cases yet</p>
          <div
            v-if="!searchQuery && authStore.isProjectManager"
            class="empty-state-actions"
          >
            <template v-if="!hasAnySuites">
              <Button
                label="Add Section"
                icon="pi pi-plus"
                data-testid="empty-add-section-btn"
                @click="handleAddRootSuite"
              />
              <Button
                label="Add Test Case"
                icon="pi pi-plus"
                severity="secondary"
                outlined
                :disabled="true"
                v-tooltip.bottom="'Create a section first'"
              />
            </template>
            <template v-else>
              <Button
                label="Add Test Case"
                icon="pi pi-plus"
                data-testid="empty-add-case-btn"
                @click="emit('add-case', selectedSuiteId)"
              />
              <Button
                label="Add Section"
                icon="pi pi-plus"
                severity="secondary"
                outlined
                @click="handleAddRootSuite"
              />
            </template>
          </div>
        </div>

        <!-- Sections -->
        <TestCaseSection
          v-for="suite in visibleSuites"
          :key="suite.id"
          :suite="suite"
          :testCases="testCasesBySuite.get(suite.id) || []"
          :selectedIds="selectedCaseIds"
          :forceCollapsed="collapseAll"
          @select-case="handleCaseSelect"
          @toggle-select="handleCaseToggleSelect"
          @add-case="handleAddCase"
          @add-subsection="handleAddSubsection"
          @edit-suite="handleEditSuite"
          @delete-suite="handleDeleteSuite"
          @delete-case="handleDeleteCase"
          @reorder-case="(id, suiteId, order) => emit('reorder-case', id, suiteId, order)"
          @expand-change="handleSectionExpandChange"
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.test-case-tree-view {
  display: flex;
  height: 100%;
  background-color: var(--surface-ground);
}

/* Left Panel */
.suite-panel {
  width: 280px;
  min-width: 220px;
  max-width: 400px;
  background-color: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--surface-border);
}

.panel-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-color);
}

.suite-tree-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

/* Right Panel */
.cases-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-input {
  min-width: 250px;
}

.search-input :deep(input) {
  width: 100%;
}

.stats-bar {
  padding: 8px 16px;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  background-color: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
}

.sections-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.loading-state i,
.empty-state i {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
}

.loading-state span,
.empty-state p {
  font-size: 0.9rem;
  color: var(--text-color-secondary);
  margin: 0 0 16px 0;
}

.empty-state-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Mobile styles */
.suite-panel-overlay {
  display: none;
}

.mobile-menu-btn {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .suite-panel {
    position: fixed;
    top: 64px;
    left: 0;
    bottom: 0;
    z-index: 100;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    box-shadow: none;
  }

  .suite-panel.mobile-visible {
    transform: translateX(0);
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
  }

  .suite-panel.mobile-hidden {
    transform: translateX(-100%);
  }

  .suite-panel-overlay {
    display: block;
    position: fixed;
    top: 64px;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 99;
  }

  .panel-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar-left {
    flex: 1;
    min-width: 0;
  }

  .search-input {
    min-width: 0;
    flex: 1;
  }

  .toolbar-right {
    flex-wrap: wrap;
  }

  .sections-container {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .toolbar-right :deep(.p-button-label) {
    display: none;
  }

  .toolbar-right :deep(.p-button) {
    padding: 0.5rem;
  }
}
</style>
