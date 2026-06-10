<script setup lang="ts">
import { ref, computed } from "vue";
import { usePreferencesStore } from "@/stores/preferences";
import { useSavedFiltersStore } from "@/stores/savedFilters";
import { useNotificationsStore } from "@/stores/notifications";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Select from "primevue/select";
import InputNumber from "primevue/inputnumber";
import InputSwitch from "primevue/inputswitch";
import Button from "primevue/button";
import Divider from "primevue/divider";
import ConfirmDialog from "@/components/common/ConfirmDialog.vue";

const preferencesStore = usePreferencesStore();
const savedFiltersStore = useSavedFiltersStore();
const notificationsStore = useNotificationsStore();

const preferences = computed(() => preferencesStore.preferences);

const showResetConfirm = ref(false);

const themeOptions = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

const pageSizeOptions = [
  { label: "10 rows", value: 10 },
  { label: "25 rows", value: 25 },
  { label: "50 rows", value: 50 },
  { label: "100 rows", value: 100 },
];

const defaultStatusOptions = [
  { label: "None", value: null },
  { label: "Passed", value: "passed" },
  { label: "Failed", value: "failed" },
];

const notificationDurationOptions = [
  { label: "3 seconds", value: 3000 },
  { label: "5 seconds", value: 5000 },
  { label: "8 seconds", value: 8000 },
  { label: "10 seconds", value: 10000 },
];

function updatePreference<K extends keyof typeof preferences.value>(
  key: K,
  value: (typeof preferences.value)[K],
) {
  preferencesStore.setPreference(key, value);
}

function resetAllPreferences() {
  preferencesStore.resetPreferences();
  showResetConfirm.value = false;
  notificationsStore.success(
    "Preferences Reset",
    "All preferences have been reset to defaults",
  );
}

function clearAllSavedFilters() {
  savedFiltersStore.filters.forEach((f) => {
    savedFiltersStore.deleteFilter(f.id);
  });
  notificationsStore.success(
    "Filters Cleared",
    "All saved filters have been removed",
  );
}

const savedFiltersCount = computed(() => savedFiltersStore.filters.length);
</script>

<template>
  <DefaultLayout>
    <div class="settings-view">
      <div class="page-header">
        <h1>Settings</h1>
        <p class="page-subtitle">Customize your Testoria experience</p>
      </div>

      <div class="settings-grid">
        <!-- Appearance Settings -->
        <Card class="settings-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-palette"></i>
              Appearance
            </div>
          </template>
          <template #content>
            <div class="settings-section">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Theme</label>
                  <span class="setting-description"
                    >Choose your preferred color theme</span
                  >
                </div>
                <Select
                  :model-value="preferences.theme"
                  :options="themeOptions"
                  option-label="label"
                  option-value="value"
                  @update:model-value="updatePreference('theme', $event)"
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Compact Mode</label>
                  <span class="setting-description"
                    >Reduce spacing for denser display</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.compactMode"
                  @update:model-value="updatePreference('compactMode', $event)"
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Sidebar Collapsed by Default</label>
                  <span class="setting-description"
                    >Start with collapsed sidebar</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.sidebarCollapsed"
                  @update:model-value="
                    updatePreference('sidebarCollapsed', $event)
                  "
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Table Settings -->
        <Card class="settings-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-table"></i>
              Tables & Lists
            </div>
          </template>
          <template #content>
            <div class="settings-section">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Default Page Size</label>
                  <span class="setting-description"
                    >Number of rows per page</span
                  >
                </div>
                <Select
                  :model-value="preferences.defaultPageSize"
                  :options="pageSizeOptions"
                  option-label="label"
                  option-value="value"
                  @update:model-value="
                    updatePreference('defaultPageSize', $event)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Show Gridlines</label>
                  <span class="setting-description"
                    >Display cell borders in tables</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.showGridlines"
                  @update:model-value="
                    updatePreference('showGridlines', $event)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Striped Rows</label>
                  <span class="setting-description"
                    >Alternate row background colors</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.stripedRows"
                  @update:model-value="updatePreference('stripedRows', $event)"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Test Execution Settings -->
        <Card class="settings-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-play"></i>
              Test Execution
            </div>
          </template>
          <template #content>
            <div class="settings-section">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Auto-Advance</label>
                  <span class="setting-description"
                    >Move to next test after submitting result</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.autoAdvance"
                  @update:model-value="updatePreference('autoAdvance', $event)"
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Show Timer</label>
                  <span class="setting-description"
                    >Display execution timer during test runs</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.showTimer"
                  @update:model-value="updatePreference('showTimer', $event)"
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Confirm Status Changes</label>
                  <span class="setting-description"
                    >Ask for confirmation before changing status</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.confirmOnStatusChange"
                  @update:model-value="
                    updatePreference('confirmOnStatusChange', $event)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Default Result Status</label>
                  <span class="setting-description"
                    >Initial status for new test results</span
                  >
                </div>
                <Select
                  :model-value="preferences.defaultResultStatus"
                  :options="defaultStatusOptions"
                  option-label="label"
                  option-value="value"
                  @update:model-value="
                    updatePreference('defaultResultStatus', $event)
                  "
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Notification Settings -->
        <Card class="settings-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-bell"></i>
              Notifications
            </div>
          </template>
          <template #content>
            <div class="settings-section">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Enable Notifications</label>
                  <span class="setting-description"
                    >Show toast notifications</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.enableNotifications"
                  @update:model-value="
                    updatePreference('enableNotifications', $event)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Notification Duration</label>
                  <span class="setting-description"
                    >How long notifications stay visible</span
                  >
                </div>
                <Select
                  :model-value="preferences.notificationDuration"
                  :options="notificationDurationOptions"
                  option-label="label"
                  option-value="value"
                  :disabled="!preferences.enableNotifications"
                  @update:model-value="
                    updatePreference('notificationDuration', $event)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Sound Effects</label>
                  <span class="setting-description"
                    >Play sound for notifications</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.soundEnabled"
                  :disabled="!preferences.enableNotifications"
                  @update:model-value="updatePreference('soundEnabled', $event)"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Editor Settings -->
        <Card class="settings-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-code"></i>
              Editor
            </div>
          </template>
          <template #content>
            <div class="settings-section">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Font Size</label>
                  <span class="setting-description"
                    >Editor text size in pixels</span
                  >
                </div>
                <InputNumber
                  :model-value="preferences.editorFontSize"
                  :min="10"
                  :max="24"
                  suffix=" px"
                  @update:model-value="
                    updatePreference('editorFontSize', $event || 14)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Show Line Numbers</label>
                  <span class="setting-description"
                    >Display line numbers in editor</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.showLineNumbers"
                  @update:model-value="
                    updatePreference('showLineNumbers', $event)
                  "
                />
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <label>Word Wrap</label>
                  <span class="setting-description"
                    >Wrap long lines in editor</span
                  >
                </div>
                <InputSwitch
                  :model-value="preferences.wordWrap"
                  @update:model-value="updatePreference('wordWrap', $event)"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Data Management -->
        <Card class="settings-card">
          <template #title>
            <div class="card-title">
              <i class="pi pi-database"></i>
              Data Management
            </div>
          </template>
          <template #content>
            <div class="settings-section">
              <div class="setting-item">
                <div class="setting-info">
                  <label>Saved Filters</label>
                  <span class="setting-description"
                    >{{ savedFiltersCount }} saved filter(s)</span
                  >
                </div>
                <Button
                  label="Clear All"
                  severity="secondary"
                  size="small"
                  :disabled="savedFiltersCount === 0"
                  @click="clearAllSavedFilters"
                />
              </div>

              <Divider />

              <div class="setting-item">
                <div class="setting-info">
                  <label>Reset Preferences</label>
                  <span class="setting-description"
                    >Restore all settings to default values</span
                  >
                </div>
                <Button
                  label="Reset All"
                  severity="danger"
                  size="small"
                  outlined
                  @click="showResetConfirm = true"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <ConfirmDialog
      v-model:visible="showResetConfirm"
      type="warning"
      title="Reset Preferences"
      message="This will reset all preferences to their default values. This action cannot be undone."
      confirm-label="Reset"
      @confirm="resetAllPreferences"
    />
  </DefaultLayout>
</template>

<style scoped>
.settings-view {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.page-subtitle {
  color: var(--text-color-secondary);
  margin: 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

@media (max-width: 1024px) {
  .settings-grid {
    grid-template-columns: 1fr;
  }
}

.settings-card {
  border-radius: 12px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
}

.card-title i {
  color: var(--primary-color);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.setting-info label {
  font-weight: 500;
  color: var(--text-color);
}

.setting-description {
  font-size: 0.875rem;
  color: var(--text-color-secondary);
}
</style>
