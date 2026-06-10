import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { FilterValues } from "@/components/common/FilterPanel.vue";

export interface SavedFilter {
  id: string;
  name: string;
  context: string; // e.g., 'test-cases', 'test-runs', 'projects'
  filters: FilterValues;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "testoria_saved_filters";

export const useSavedFiltersStore = defineStore("savedFilters", () => {
  const filters = ref<SavedFilter[]>([]);

  // Load from localStorage on init
  function loadFilters(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        filters.value = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load saved filters:", e);
      filters.value = [];
    }
  }

  // Save to localStorage
  function persistFilters(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters.value));
    } catch (e) {
      console.error("Failed to save filters:", e);
    }
  }

  // Get filters for a specific context
  const getFiltersByContext = computed(
    () => (context: string) =>
      filters.value.filter((f) => f.context === context),
  );

  // Get default filter for a context
  const getDefaultFilter = computed(
    () => (context: string) =>
      filters.value.find((f) => f.context === context && f.isDefault),
  );

  function generateId(): string {
    return `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  function saveFilter(
    name: string,
    context: string,
    filterValues: FilterValues,
    setAsDefault = false,
  ): SavedFilter {
    const now = new Date().toISOString();

    // If setting as default, clear other defaults in same context
    if (setAsDefault) {
      filters.value.forEach((f) => {
        if (f.context === context) {
          f.isDefault = false;
        }
      });
    }

    // Upsert: if a filter with the same name exists in this context, update it
    const existingIndex = filters.value.findIndex(
      (f) => f.name === name && f.context === context,
    );

    if (existingIndex !== -1) {
      filters.value[existingIndex] = {
        ...filters.value[existingIndex],
        filters: { ...filterValues },
        isDefault: setAsDefault,
        updatedAt: now,
      };
      persistFilters();
      return filters.value[existingIndex];
    }

    const newFilter: SavedFilter = {
      id: generateId(),
      name,
      context,
      filters: { ...filterValues },
      isDefault: setAsDefault,
      createdAt: now,
      updatedAt: now,
    };

    filters.value.push(newFilter);
    persistFilters();

    return newFilter;
  }

  function updateFilter(
    id: string,
    updates: Partial<Pick<SavedFilter, "name" | "filters" | "isDefault">>,
  ): SavedFilter | null {
    const index = filters.value.findIndex((f) => f.id === id);
    if (index === -1) return null;

    const filter = filters.value[index];

    // If setting as default, clear other defaults in same context
    if (updates.isDefault) {
      filters.value.forEach((f) => {
        if (f.context === filter.context && f.id !== id) {
          f.isDefault = false;
        }
      });
    }

    filters.value[index] = {
      ...filter,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    persistFilters();
    return filters.value[index];
  }

  function deleteFilter(id: string): boolean {
    const index = filters.value.findIndex((f) => f.id === id);
    if (index === -1) return false;

    filters.value.splice(index, 1);
    persistFilters();
    return true;
  }

  function setAsDefault(id: string): boolean {
    const filter = filters.value.find((f) => f.id === id);
    if (!filter) return false;

    // Clear other defaults in same context
    filters.value.forEach((f) => {
      if (f.context === filter.context) {
        f.isDefault = f.id === id;
      }
    });

    persistFilters();
    return true;
  }

  function clearDefault(context: string): void {
    filters.value.forEach((f) => {
      if (f.context === context) {
        f.isDefault = false;
      }
    });
    persistFilters();
  }

  // Initialize
  loadFilters();

  return {
    filters,
    getFiltersByContext,
    getDefaultFilter,
    saveFilter,
    updateFilter,
    deleteFilter,
    setAsDefault,
    clearDefault,
    loadFilters,
  };
});
