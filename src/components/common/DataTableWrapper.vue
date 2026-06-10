<script setup lang="ts">
import { computed, useSlots } from "vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import InputText from "primevue/inputtext";
import LoadingState from "./LoadingState.vue";
import EmptyState from "./EmptyState.vue";

export interface ColumnDef {
  field: string;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string;
  align?: "left" | "center" | "right";
  frozen?: boolean;
}

const props = withDefaults(
  defineProps<{
    data: unknown[];
    columns: ColumnDef[];
    loading?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    paginator?: boolean;
    rows?: number;
    rowsPerPageOptions?: number[];
    selectionMode?: "single" | "multiple" | null;
    selection?: unknown | unknown[];
    emptyIcon?: string;
    emptyTitle?: string;
    emptyMessage?: string;
    emptyActionLabel?: string;
    scrollable?: boolean;
    scrollHeight?: string;
    stripedRows?: boolean;
    showGridlines?: boolean;
    dataKey?: string;
    rowHover?: boolean;
  }>(),
  {
    loading: false,
    searchable: true,
    searchPlaceholder: "Search...",
    paginator: true,
    rows: 10,
    rowsPerPageOptions: () => [10, 25, 50],
    selectionMode: null,
    emptyIcon: "pi pi-inbox",
    emptyTitle: "No data found",
    emptyMessage: "There are no records to display.",
    scrollable: false,
    scrollHeight: "400px",
    stripedRows: true,
    showGridlines: false,
    dataKey: "id",
    rowHover: true,
  },
);

const emit = defineEmits<{
  (e: "update:selection", value: unknown | unknown[]): void;
  (e: "row-click", event: { data: unknown; index: number }): void;
  (e: "row-dblclick", event: { data: unknown; index: number }): void;
  (e: "empty-action"): void;
}>();

const slots = useSlots();

const searchQuery = defineModel<string>("searchQuery", { default: "" });

const filteredData = computed(() => {
  if (!searchQuery.value || !props.searchable) {
    return props.data;
  }

  const query = searchQuery.value.toLowerCase();
  return props.data.filter((item: unknown) => {
    const record = item as Record<string, unknown>;
    return props.columns.some((col) => {
      const value = record[col.field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(query);
    });
  });
});

function clearSearch() {
  searchQuery.value = "";
}

function hasColumnSlot(field: string): boolean {
  return !!slots[`column-${field}`];
}
</script>

<template>
  <div class="data-table-wrapper">
    <!-- Search Bar -->
    <div v-if="searchable" class="table-toolbar">
      <div class="search-container">
        <span class="p-input-icon-left p-input-icon-right">
          <i class="pi pi-search" />
          <InputText
            v-model="searchQuery"
            :placeholder="searchPlaceholder"
            class="search-input"
          />
          <i
            v-if="searchQuery"
            class="pi pi-times clear-icon"
            @click="clearSearch"
          />
        </span>
      </div>
      <slot name="toolbar-end"></slot>
    </div>

    <!-- Loading State -->
    <LoadingState v-if="loading" type="skeleton" :lines="5" full-height />

    <!-- Empty State -->
    <EmptyState
      v-else-if="filteredData.length === 0"
      :icon="emptyIcon"
      :title="emptyTitle"
      :message="emptyMessage"
      :action-label="emptyActionLabel"
      @action="emit('empty-action')"
    />

    <!-- Data Table -->
    <DataTable
      v-else
      :value="filteredData"
      :paginator="paginator"
      :rows="rows"
      :rows-per-page-options="rowsPerPageOptions"
      :selection="selection"
      :selection-mode="selectionMode || undefined"
      :scrollable="scrollable"
      :scroll-height="scrollHeight"
      :striped-rows="stripedRows"
      :show-gridlines="showGridlines"
      :data-key="dataKey"
      :row-hover="rowHover"
      responsive-layout="scroll"
      @update:selection="emit('update:selection', $event)"
      @row-click="emit('row-click', $event)"
      @row-dblclick="emit('row-dblclick', $event)"
    >
      <Column
        v-if="selectionMode"
        selection-mode="multiple"
        header-style="width: 3rem"
      />

      <Column
        v-for="col in columns"
        :key="col.field"
        :field="col.field"
        :header="col.header"
        :sortable="col.sortable"
        :style="{ width: col.width, textAlign: col.align }"
        :frozen="col.frozen"
      >
        <template #body="slotProps">
          <slot
            v-if="hasColumnSlot(col.field)"
            :name="`column-${col.field}`"
            :data="slotProps.data"
            :index="slotProps.index"
          />
          <span v-else>{{ slotProps.data[col.field] }}</span>
        </template>
      </Column>

      <Column
        v-if="$slots.actions"
        header="Actions"
        :style="{ width: '120px' }"
      >
        <template #body="slotProps">
          <slot
            name="actions"
            :data="slotProps.data"
            :index="slotProps.index"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.data-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.search-container {
  flex: 1;
  max-width: 400px;
}

.search-container :deep(.p-input-icon-left),
.search-container :deep(.p-input-icon-right) {
  width: 100%;
}

.search-input {
  width: 100%;
}

.clear-icon {
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  z-index: 2;
}

.clear-icon:hover {
  opacity: 1;
}

:deep(.p-paginator) {
  border: none;
  border-top: 1px solid var(--surface-border);
  padding: 0.75rem 1rem;
  background: var(--surface-card);
}
</style>
