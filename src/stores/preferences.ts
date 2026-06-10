import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface UserPreferences {
  // Display preferences
  theme: "light" | "dark";
  compactMode: boolean;
  sidebarCollapsed: boolean;

  // Table preferences
  defaultPageSize: number;
  showGridlines: boolean;
  stripedRows: boolean;

  // Test execution preferences
  autoAdvance: boolean;
  showTimer: boolean;
  confirmOnStatusChange: boolean;
  defaultResultStatus: "passed" | "failed" | null;

  // Notification preferences
  enableNotifications: boolean;
  notificationDuration: number;
  soundEnabled: boolean;

  // Editor preferences
  editorFontSize: number;
  showLineNumbers: boolean;
  wordWrap: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  compactMode: false,
  sidebarCollapsed: false,
  defaultPageSize: 10,
  showGridlines: false,
  stripedRows: true,
  autoAdvance: true,
  showTimer: true,
  confirmOnStatusChange: false,
  defaultResultStatus: null,
  enableNotifications: true,
  notificationDuration: 5000,
  soundEnabled: false,
  editorFontSize: 14,
  showLineNumbers: true,
  wordWrap: true,
};

const STORAGE_KEY = "testoria_preferences";

export const usePreferencesStore = defineStore("preferences", () => {
  const preferences = ref<UserPreferences>({ ...DEFAULT_PREFERENCES });

  // Load preferences from localStorage
  function loadPreferences(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        preferences.value = { ...DEFAULT_PREFERENCES, ...parsed };
        // Migrate legacy "system" theme → "light"
        if ((preferences.value.theme as string) === "system") {
          preferences.value.theme = "light";
        }
      }
    } catch (e) {
      console.error("Failed to load preferences:", e);
      preferences.value = { ...DEFAULT_PREFERENCES };
    }
  }

  // Save preferences to localStorage
  function savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences.value));
    } catch (e) {
      console.error("Failed to save preferences:", e);
    }
  }

  // Watch for changes and persist
  watch(preferences, savePreferences, { deep: true });

  // Update a single preference
  function setPreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ): void {
    preferences.value[key] = value;
  }

  // Update multiple preferences
  function setPreferences(updates: Partial<UserPreferences>): void {
    preferences.value = { ...preferences.value, ...updates };
  }

  // Reset to defaults
  function resetPreferences(): void {
    preferences.value = { ...DEFAULT_PREFERENCES };
  }

  // Reset a specific preference to default
  function resetPreference<K extends keyof UserPreferences>(key: K): void {
    preferences.value[key] = DEFAULT_PREFERENCES[key];
  }

  // Apply theme to document
  function applyTheme(): void {
    document.documentElement.setAttribute(
      "data-theme",
      preferences.value.theme,
    );
  }

  // Watch theme changes
  watch(() => preferences.value.theme, applyTheme);

  // Initialize
  loadPreferences();
  applyTheme();

  return {
    preferences,
    setPreference,
    setPreferences,
    resetPreferences,
    resetPreference,
    loadPreferences,
    applyTheme,
  };
});
