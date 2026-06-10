<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { debounce } from "lodash-es";
import Button from "primevue/button";
import Select from "primevue/select";
import MultiSelect from "primevue/multiselect";
import InputText from "primevue/inputtext";
import Calendar from "primevue/calendar";
import Chip from "primevue/chip";

export interface FilterOption {
  label: string;
  value: string | number | boolean;
}

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "multiselect" | "text" | "date" | "daterange";
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterValues {
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    filters: FilterField[];
    modelValue: FilterValues;
    collapsible?: boolean;
    collapsed?: boolean;
    showClearButton?: boolean;
    showActiveFilters?: boolean;
    inline?: boolean;
  }>(),
  {
    collapsible: false,
    collapsed: false,
    showClearButton: true,
    showActiveFilters: true,
    inline: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: FilterValues): void;
  (e: "filter"): void;
  (e: "clear"): void;
}>();

const isCollapsed = ref(props.collapsed);

const localValues = ref<FilterValues>({ ...props.modelValue });

// Debounce the filter event so rapid text input doesn't spam API calls
const emitFilterDebounced = debounce(() => emit("filter"), 300);

watch(
  () => props.modelValue,
  (newVal) => {
    localValues.value = { ...newVal };
  },
  { deep: true },
);

const activeFilters = computed(() => {
  return props.filters.filter((f) => {
    const value = localValues.value[f.key];
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "string") return value.trim() !== "";
    return true;
  });
});

const hasActiveFilters = computed(() => activeFilters.value.length > 0);

function updateFilter(key: string, value: unknown) {
  localValues.value = { ...localValues.value, [key]: value };
  emit("update:modelValue", localValues.value);
  emitFilterDebounced();
}

function clearFilter(key: string) {
  const newValues = { ...localValues.value };
  delete newValues[key];
  localValues.value = newValues;
  emit("update:modelValue", newValues);
  emit("filter");
}

function clearAllFilters() {
  localValues.value = {};
  emit("update:modelValue", {});
  emit("clear");
}

function getFilterDisplayValue(filter: FilterField): string {
  const value = localValues.value[filter.key];

  if (filter.type === "multiselect" && Array.isArray(value)) {
    const selectedLabels = value.map((v) => {
      const option = filter.options?.find((o) => o.value === v);
      return option?.label || v;
    });
    return selectedLabels.join(", ");
  }

  if (filter.type === "select" && filter.options) {
    const option = filter.options.find((o) => o.value === value);
    return option?.label || String(value);
  }

  if (filter.type === "daterange" && Array.isArray(value)) {
    const [start, end] = value as [Date, Date];
    if (start && end) {
      return `${formatDate(start)} - ${formatDate(end)}`;
    }
  }

  if (filter.type === "date" && value instanceof Date) {
    return formatDate(value);
  }

  return String(value);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value;
}
</script>

<template>
  <div class="filter-panel" :class="{ collapsed: isCollapsed, inline }">
    <!-- Header -->
    <div v-if="collapsible" class="filter-header" @click="toggleCollapse">
      <div class="filter-title">
        <i class="pi pi-filter"></i>
        <span>Filters</span>
        <span v-if="hasActiveFilters" class="active-count"
          >({{ activeFilters.length }})</span
        >
      </div>
      <i :class="['pi', isCollapsed ? 'pi-chevron-down' : 'pi-chevron-up']"></i>
    </div>

    <!-- Filter Content -->
    <div v-show="!isCollapsed" class="filter-content">
      <!-- Active Filter Chips -->
      <div v-if="showActiveFilters && hasActiveFilters" class="active-filters">
        <Chip
          v-for="filter in activeFilters"
          :key="filter.key"
          :label="`${filter.label}: ${getFilterDisplayValue(filter)}`"
          removable
          @remove="clearFilter(filter.key)"
        />
        <Button
          v-if="showClearButton && activeFilters.length > 1"
          label="Clear All"
          text
          size="small"
          @click="clearAllFilters"
        />
      </div>

      <!-- Filter Fields -->
      <div class="filter-fields">
        <div v-for="filter in filters" :key="filter.key" class="filter-field">
          <label :for="`filter-${filter.key}`">{{ filter.label }}</label>

          <!-- Select -->
          <Select
            v-if="filter.type === 'select'"
            :id="`filter-${filter.key}`"
            :model-value="localValues[filter.key]"
            :options="filter.options"
            option-label="label"
            option-value="value"
            :placeholder="filter.placeholder || `Select ${filter.label}`"
            show-clear
            class="w-full"
            @update:model-value="updateFilter(filter.key, $event)"
          />

          <!-- MultiSelect -->
          <MultiSelect
            v-else-if="filter.type === 'multiselect'"
            :id="`filter-${filter.key}`"
            :model-value="localValues[filter.key] || []"
            :options="filter.options"
            option-label="label"
            option-value="value"
            :placeholder="filter.placeholder || `Select ${filter.label}`"
            display="chip"
            class="w-full"
            @update:model-value="updateFilter(filter.key, $event)"
          />

          <!-- Text -->
          <InputText
            v-else-if="filter.type === 'text'"
            :id="`filter-${filter.key}`"
            :model-value="(localValues[filter.key] as string) || ''"
            :placeholder="filter.placeholder || `Enter ${filter.label}`"
            class="w-full"
            @update:model-value="updateFilter(filter.key, $event)"
          />

          <!-- Date -->
          <Calendar
            v-else-if="filter.type === 'date'"
            :id="`filter-${filter.key}`"
            :model-value="localValues[filter.key] as Date"
            :placeholder="filter.placeholder || `Select ${filter.label}`"
            show-icon
            show-button-bar
            class="w-full"
            @update:model-value="updateFilter(filter.key, $event)"
          />

          <!-- Date Range -->
          <Calendar
            v-else-if="filter.type === 'daterange'"
            :id="`filter-${filter.key}`"
            :model-value="localValues[filter.key] as Date[]"
            :placeholder="filter.placeholder || `Select ${filter.label}`"
            selection-mode="range"
            show-icon
            show-button-bar
            class="w-full"
            @update:model-value="updateFilter(filter.key, $event)"
          />
        </div>
      </div>

      <!-- Actions -->
      <div
        v-if="showClearButton && hasActiveFilters && !showActiveFilters"
        class="filter-actions"
      >
        <Button
          label="Clear Filters"
          icon="pi pi-times"
          severity="secondary"
          text
          @click="clearAllFilters"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.filter-panel {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  overflow: hidden;
}

.filter-panel.inline {
  background: transparent;
  border: none;
  border-radius: 0;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--surface-section);
  cursor: pointer;
  user-select: none;
}

.filter-header:hover {
  background: var(--surface-hover);
}

.filter-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.active-count {
  color: var(--primary-color);
  font-size: 0.875rem;
}

.filter-content {
  padding: 16px;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--surface-border);
}

.filter-fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.filter-panel.inline .filter-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.filter-panel.inline .filter-field {
  min-width: 180px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-color-secondary);
}

.filter-actions {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--surface-border);
}

.w-full {
  width: 100%;
}
</style>
