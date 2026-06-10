<script setup lang="ts">
import { ref, computed } from "vue";
import { useSavedFiltersStore, type SavedFilter } from "@/stores/savedFilters";
import type { FilterValues } from "./FilterPanel.vue";
import type { MenuItem } from "primevue/menuitem";
import Button from "primevue/button";
import Menu from "primevue/menu";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Checkbox from "primevue/checkbox";

const props = defineProps<{
  context: string;
  currentFilters: FilterValues;
}>();

const emit = defineEmits<{
  (e: "apply", filters: FilterValues): void;
}>();

const savedFiltersStore = useSavedFiltersStore();

const menuRef = ref();
const showSaveDialog = ref(false);
const newFilterName = ref("");
const setAsDefault = ref(false);

const savedFilters = computed(() =>
  savedFiltersStore.getFiltersByContext(props.context),
);

const hasFiltersToSave = computed(
  () => Object.keys(props.currentFilters).length > 0,
);

const menuItems = computed((): MenuItem[] => {
  const items: MenuItem[] = [];

  if (savedFilters.value.length > 0) {
    items.push({
      label: "Saved Filters",
      items: savedFilters.value.map((filter) => ({
        label: filter.name,
        icon: filter.isDefault ? "pi pi-star-fill" : "pi pi-filter",
        command: () => applyFilter(filter),
      })),
    });
    items.push({ separator: true });
  }

  items.push({
    label: "Save Current Filters",
    icon: "pi pi-save",
    disabled: !hasFiltersToSave.value,
    command: () => openSaveDialog(),
  });

  if (savedFilters.value.length > 0) {
    items.push({
      label: "Manage Filters",
      icon: "pi pi-cog",
      command: () => openManageDialog(),
    });
  }

  return items;
});

const showManageDialog = ref(false);
const inlineRenamingId = ref<string | null>(null);
const inlineRenameValue = ref("");

function toggleMenu(event: Event) {
  menuRef.value.toggle(event);
}

function applyFilter(filter: SavedFilter) {
  emit("apply", { ...filter.filters });
}

function openSaveDialog() {
  newFilterName.value = "";
  setAsDefault.value = false;
  showSaveDialog.value = true;
}

function openManageDialog() {
  showManageDialog.value = true;
}

function saveFilter() {
  if (!newFilterName.value.trim()) return;

  savedFiltersStore.saveFilter(
    newFilterName.value.trim(),
    props.context,
    props.currentFilters,
    setAsDefault.value,
  );

  showSaveDialog.value = false;
  newFilterName.value = "";
  setAsDefault.value = false;
}

function startInlineRename(filter: SavedFilter) {
  inlineRenamingId.value = filter.id;
  inlineRenameValue.value = filter.name;
}

function commitInlineRename(filter: SavedFilter) {
  const trimmed = inlineRenameValue.value.trim();
  if (trimmed && trimmed !== filter.name) {
    savedFiltersStore.updateFilter(filter.id, { name: trimmed });
  }
  inlineRenamingId.value = null;
}

function cancelInlineRename() {
  inlineRenamingId.value = null;
}

function deleteFilter(filter: SavedFilter) {
  savedFiltersStore.deleteFilter(filter.id);
}

function toggleDefault(filter: SavedFilter) {
  if (filter.isDefault) {
    savedFiltersStore.clearDefault(props.context);
  } else {
    savedFiltersStore.setAsDefault(filter.id);
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <div class="saved-filters-dropdown">
    <Button
      icon="pi pi-bookmark"
      severity="secondary"
      text
      rounded
      aria-label="Saved Filters"
      @click="toggleMenu"
    />
    <Menu ref="menuRef" :model="menuItems" popup />

    <!-- Save Filter Dialog -->
    <Dialog
      v-model:visible="showSaveDialog"
      header="Save Filter"
      :style="{ width: '400px' }"
      modal
    >
      <div class="save-filter-form">
        <div class="form-field">
          <label for="filter-name">Filter Name</label>
          <InputText
            id="filter-name"
            v-model="newFilterName"
            placeholder="Enter filter name"
            class="w-full"
            autofocus
          />
        </div>
        <div class="form-field checkbox-field">
          <Checkbox id="set-default" v-model="setAsDefault" :binary="true" />
          <label for="set-default">Set as default filter</label>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancel"
          severity="secondary"
          text
          @click="showSaveDialog = false"
        />
        <Button
          label="Save"
          icon="pi pi-check"
          :disabled="!newFilterName.trim()"
          @click="saveFilter"
        />
      </template>
    </Dialog>

    <!-- Manage Filters Dialog -->
    <Dialog
      v-model:visible="showManageDialog"
      header="Manage Saved Filters"
      :style="{ width: '500px' }"
      modal
    >
      <div v-if="savedFilters.length === 0" class="empty-filters">
        <i class="pi pi-filter-slash"></i>
        <p>No saved filters yet</p>
      </div>
      <div v-else class="filters-list">
        <div
          v-for="filter in savedFilters"
          :key="filter.id"
          class="filter-item"
        >
          <div class="filter-info">
            <!-- Inline rename mode -->
            <div v-if="inlineRenamingId === filter.id" class="inline-rename">
              <InputText
                v-model="inlineRenameValue"
                size="small"
                class="rename-input"
                autofocus
                @keydown.enter="commitInlineRename(filter)"
                @keydown.escape="cancelInlineRename"
                @blur="commitInlineRename(filter)"
              />
            </div>
            <!-- Display mode -->
            <div
              v-else
              class="filter-name"
              v-tooltip.top="`Created ${formatDate(filter.createdAt)}`"
            >
              <i
                v-if="filter.isDefault"
                class="pi pi-star-fill default-star"
              ></i>
              {{ filter.name }}
            </div>
            <div class="filter-meta">
              Created {{ formatDate(filter.createdAt) }}
            </div>
          </div>
          <div class="filter-actions">
            <Button
              :icon="filter.isDefault ? 'pi pi-star-fill' : 'pi pi-star'"
              text
              rounded
              size="small"
              :severity="filter.isDefault ? 'warning' : 'secondary'"
              @click="toggleDefault(filter)"
              v-tooltip="filter.isDefault ? 'Remove default' : 'Set as default'"
            />
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              v-tooltip="'Rename'"
              @click="startInlineRename(filter)"
            />
            <Button
              icon="pi pi-trash"
              text
              rounded
              size="small"
              severity="danger"
              @click="deleteFilter(filter)"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          label="Close"
          severity="secondary"
          @click="showManageDialog = false"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.save-filter-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-field label {
  font-weight: 500;
  font-size: 0.875rem;
}

.checkbox-field {
  flex-direction: row;
  align-items: center;
}

.checkbox-field label {
  cursor: pointer;
}

.w-full {
  width: 100%;
}

.empty-filters {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
  color: var(--text-color-secondary);
}

.empty-filters i {
  font-size: 2rem;
  margin-bottom: 12px;
  opacity: 0.5;
}

.filters-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--surface-ground);
  border-radius: 6px;
}

.filter-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-name {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.default-star {
  color: var(--yellow-500);
  font-size: 0.875rem;
}

.filter-meta {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.inline-rename {
  display: flex;
  align-items: center;
}

.rename-input {
  font-size: 0.875rem;
  height: 28px;
  padding: 2px 8px;
}

.filter-actions {
  display: flex;
  gap: 4px;
}
</style>
