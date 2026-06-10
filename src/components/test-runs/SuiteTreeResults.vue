<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { TestSuiteTree } from "@/types/testSuite";
import type { TestCaseWithResult } from "@/types/testRun";
import type { TestResult, ResultStatus } from "@/types/testResult";
import {
  RESULT_STATUS_COLORS,
  RESULT_STATUS_ICONS,
} from "@/types/testResult";
import SuiteTreeBranch, {
  type SuiteTreeNode,
} from "./SuiteTreeBranch.vue";

const props = defineProps<{
  /** Already-filtered case list. Pass `runCases` unfiltered for no filtering. */
  cases: TestCaseWithResult[];
  /** Flat list of results keyed by `test_case_id`. */
  results: TestResult[];
  /** Backend-ordered suite hierarchy for the project. */
  suiteTree: TestSuiteTree[];
  /** Row affordance mode. `read` renders result cards; `execute` renders compact picker rows. */
  mode: "read" | "execute";
  /** Currently selected test case id (for highlight). */
  selectedCaseId?: number | null;
  /** Currently selected result id (for `read` mode highlight — usually matches test_case_id). */
  selectedResult?: TestResult | null;
  /** Run id — used as the localStorage key for collapse state. */
  runId: number;
}>();

const emit = defineEmits<{
  /** Emitted with the case id the user clicked. Parent decides the follow-up. */
  (e: "select", caseId: number): void;
}>();

const COLLAPSE_STORAGE_KEY = "testoria.suiteTree.collapsed";
const COLLAPSE_STORAGE_MAX_RUNS = 50;

type CollapseStore = Record<string, Record<string, boolean>>;

function readCollapseStore(): CollapseStore {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CollapseStore) : {};
  } catch {
    return {};
  }
}

function writeCollapseStore(store: CollapseStore) {
  try {
    const keys = Object.keys(store);
    let out = store;
    if (keys.length > COLLAPSE_STORAGE_MAX_RUNS) {
      const trimmed: CollapseStore = {};
      for (const k of keys.slice(-COLLAPSE_STORAGE_MAX_RUNS)) {
        trimmed[k] = store[k];
      }
      out = trimmed;
    }
    const serialised = JSON.stringify(out);
    if (typeof serialised === "string") {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, serialised);
    }
  } catch {
    // best-effort; ignore quota errors
  }
}

const collapsed = ref<Record<string, boolean>>({});

onMounted(() => {
  const store = readCollapseStore();
  collapsed.value = { ...(store[String(props.runId)] ?? {}) };
});

watch(
  () => props.runId,
  (id) => {
    const store = readCollapseStore();
    collapsed.value = { ...(store[String(id)] ?? {}) };
  },
);

function suiteKey(id: number | null): string {
  return id == null ? "__unassigned" : String(id);
}

function isCollapsed(id: number | null): boolean {
  return !!collapsed.value[suiteKey(id)];
}

function toggleSuite(id: number | null) {
  const k = suiteKey(id);
  collapsed.value = { ...collapsed.value, [k]: !collapsed.value[k] };
  const store = readCollapseStore();
  store[String(props.runId)] = collapsed.value;
  writeCollapseStore(store);
}

function getResultFor(caseId: number): TestResult | null {
  return props.results.find((r) => r.test_case_id === caseId) ?? null;
}

function getStatusFor(caseId: number): ResultStatus {
  return getResultFor(caseId)?.status ?? "no_run";
}

function statusColor(status: ResultStatus): string {
  return RESULT_STATUS_COLORS[status] ?? "#94a3b8";
}

function statusIcon(status: ResultStatus): string {
  return RESULT_STATUS_ICONS[status] ?? "pi pi-circle";
}

const groupedTree = computed<SuiteTreeNode[]>(() => {
  const bySuite = new Map<number | null, TestCaseWithResult[]>();
  for (const tc of props.cases) {
    const suiteId = tc.suite_id ?? null;
    if (!bySuite.has(suiteId)) bySuite.set(suiteId, []);
    bySuite.get(suiteId)!.push(tc);
  }

  function build(nodes: TestSuiteTree[]): SuiteTreeNode[] {
    const out: SuiteTreeNode[] = [];
    for (const n of nodes) {
      const children = build(n.children ?? []);
      const items = bySuite.get(n.id) ?? [];
      const totalCount =
        items.length + children.reduce((s, c) => s + c.totalCount, 0);
      if (totalCount === 0) continue;
      let passed = children.reduce((s, c) => s + c.passed, 0);
      let failed = children.reduce((s, c) => s + c.failed, 0);
      let blocked = children.reduce((s, c) => s + c.blocked, 0);
      let no_run = children.reduce((s, c) => s + c.no_run, 0);
      for (const tc of items) {
        const status = getStatusFor(tc.id);
        if (status === "passed") passed++;
        else if (status === "failed") failed++;
        else if (status === "blocked") blocked++;
        else no_run++;
      }
      out.push({
        id: n.id,
        name: n.name,
        items,
        children,
        totalCount,
        passed,
        failed,
        blocked,
        no_run,
      });
    }
    return out;
  }

  const roots = build(props.suiteTree ?? []);

  // Orphan fallback: cases whose suite isn't in the tree land in "Unassigned".
  const suitesInTree = new Set<number>();
  (function collectIds(nodes: TestSuiteTree[]) {
    for (const n of nodes) {
      suitesInTree.add(n.id);
      if (n.children?.length) collectIds(n.children);
    }
  })(props.suiteTree ?? []);

  const unassigned: TestCaseWithResult[] = [];
  for (const [suiteId, items] of bySuite.entries()) {
    if (suiteId == null || !suitesInTree.has(suiteId)) {
      unassigned.push(...items);
    }
  }
  if (unassigned.length) {
    let passed = 0,
      failed = 0,
      blocked = 0,
      no_run = 0;
    for (const tc of unassigned) {
      const status = getStatusFor(tc.id);
      if (status === "passed") passed++;
      else if (status === "failed") failed++;
      else if (status === "blocked") blocked++;
      else no_run++;
    }
    roots.push({
      id: null,
      name: "Unassigned",
      items: unassigned,
      children: [],
      totalCount: unassigned.length,
      passed,
      failed,
      blocked,
      no_run,
    });
  }
  return roots;
});

// DFS the visible tree in render order. The execute view uses this to find
// the next `no_run` case stably across reloads (no more flat sort by id).
function dfsCases(nodes: SuiteTreeNode[]): TestCaseWithResult[] {
  const out: TestCaseWithResult[] = [];
  function walk(ns: SuiteTreeNode[]) {
    for (const n of ns) {
      for (const tc of n.items) out.push(tc);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

function findNextUntestedAfter(caseId: number | null): TestCaseWithResult | null {
  const ordered = dfsCases(groupedTree.value);
  const idx = caseId == null ? -1 : ordered.findIndex((tc) => tc.id === caseId);
  for (let i = idx + 1; i < ordered.length; i++) {
    if (getStatusFor(ordered[i].id) === "no_run") return ordered[i];
  }
  return null;
}

defineExpose({ findNextUntestedAfter });

function handleSelect(caseId: number) {
  emit("select", caseId);
}
</script>

<template>
  <div class="suite-tree-results">
    <SuiteTreeBranch
      v-for="group in groupedTree"
      :key="group.id ?? 'unassigned'"
      :node="group"
      :level="0"
      :mode="mode"
      :selected-case-id="selectedCaseId"
      :selected-result="selectedResult"
      :is-collapsed="isCollapsed"
      :toggle="toggleSuite"
      :get-result-for="getResultFor"
      :get-status-for="getStatusFor"
      :status-color="statusColor"
      :status-icon="statusIcon"
      @select="handleSelect"
    />
  </div>
</template>

<style scoped>
.suite-tree-results {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
