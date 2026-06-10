import { defineStore } from "pinia";
import { ref, watch } from "vue";

export interface Notification {
  id: string;
  severity: "success" | "info" | "warn" | "error";
  summary: string;
  detail?: string;
  life?: number;
}

const SUITE_EXPAND_KEY = "suiteExpandedState";

export const useUIStore = defineStore("ui", () => {
  const sidebarVisible = ref(true);
  const sidebarCollapsed = ref(false);
  const darkMode = ref(false);
  const notifications = ref<Notification[]>([]);
  const globalLoading = ref(false);

  // Suite tree expand/collapse state — keyed by suite ID, persisted to localStorage
  const suiteExpandedState = ref<Record<number, boolean>>(
    JSON.parse(localStorage.getItem(SUITE_EXPAND_KEY) || "{}"),
  );

  watch(
    suiteExpandedState,
    (val) => {
      localStorage.setItem(SUITE_EXPAND_KEY, JSON.stringify(val));
    },
    { deep: true },
  );

  function toggleSuiteExpand(id: number) {
    suiteExpandedState.value = {
      ...suiteExpandedState.value,
      [id]: !suiteExpandedState.value[id],
    };
  }

  function setSuiteExpanded(id: number, expanded: boolean) {
    suiteExpandedState.value = { ...suiteExpandedState.value, [id]: expanded };
  }

  function clearSuiteExpandState(id: number) {
    const next = { ...suiteExpandedState.value };
    delete next[id];
    suiteExpandedState.value = next;
  }

  function toggleSidebar() {
    sidebarVisible.value = !sidebarVisible.value;
  }

  function toggleSidebarCollapsed() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
  }

  function setSidebarVisible(visible: boolean) {
    sidebarVisible.value = visible;
  }

  function toggleDarkMode() {
    darkMode.value = !darkMode.value;
    document.documentElement.classList.toggle("dark", darkMode.value);
    localStorage.setItem("darkMode", String(darkMode.value));
  }

  function initDarkMode() {
    const saved = localStorage.getItem("darkMode");
    if (saved === "true") {
      darkMode.value = true;
      document.documentElement.classList.add("dark");
    }
  }

  function addNotification(notification: Omit<Notification, "id">) {
    const id = Date.now().toString();
    notifications.value.push({ ...notification, id });
    if (notification.life) {
      setTimeout(() => removeNotification(id), notification.life);
    }
    return id;
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  }

  function setGlobalLoading(loading: boolean) {
    globalLoading.value = loading;
  }

  return {
    sidebarVisible,
    sidebarCollapsed,
    darkMode,
    notifications,
    globalLoading,
    suiteExpandedState,
    toggleSidebar,
    toggleSidebarCollapsed,
    setSidebarVisible,
    toggleDarkMode,
    initDarkMode,
    addNotification,
    removeNotification,
    setGlobalLoading,
    toggleSuiteExpand,
    setSuiteExpanded,
    clearSuiteExpandState,
  };
});
