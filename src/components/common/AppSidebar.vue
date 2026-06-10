<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const emit = defineEmits(["toggle-sidebar", "navigate"]);

const menuItems = computed(() => {
  const items = [
    {
      label: "Dashboard",
      icon: "pi pi-home",
      route: "/",
    },
    {
      label: "Projects",
      icon: "pi pi-folder",
      route: "/projects",
    },
    {
      label: "Test Cases",
      icon: "pi pi-list",
      route: "/test-cases",
    },
    {
      label: "Test Runs",
      icon: "pi pi-play",
      route: "/test-runs",
    },
    {
      label: "Reports",
      icon: "pi pi-chart-bar",
      route: "/reports",
    },
  ];

  if (authStore.isAdmin) {
    items.push({
      label: "Users",
      icon: "pi pi-users",
      route: "/users",
    });
  }

  return items;
});

function isActive(itemRoute: string) {
  if (itemRoute === "/") {
    return route.path === "/";
  }
  const segment = itemRoute.slice(1); // e.g. 'test-cases'
  const pathSegments = route.path.split("/").filter(Boolean);
  // Find the last matching menu segment in the path to resolve conflicts
  // e.g. /projects/2/test-cases → 'test-cases' wins over 'projects'
  const allSegments = menuItems.value.map((i) => i.route.slice(1));
  const lastMatch = [...pathSegments]
    .reverse()
    .find((s) => allSegments.includes(s));
  return lastMatch === segment;
}

function navigateTo(itemRoute: string) {
  router.push(itemRoute);
  emit("navigate");
}
</script>

<template>
  <aside class="app-sidebar" aria-label="Sidebar">
    <div class="sidebar-header">
      <h1 class="sidebar-title">Testoria</h1>
    </div>
    <nav class="sidebar-nav" aria-label="Main navigation">
      <div
        v-for="item in menuItems"
        :key="item.route"
        class="nav-item"
        :class="{ active: isActive(item.route) }"
        role="link"
        tabindex="0"
        :aria-current="isActive(item.route) ? 'page' : undefined"
        @click="navigateTo(item.route)"
        @keydown.enter="navigateTo(item.route)"
        @keydown.space.prevent="navigateTo(item.route)"
      >
        <i :class="item.icon" aria-hidden="true"></i>
        <span>{{ item.label }}</span>
      </div>
    </nav>
  </aside>
</template>

<style scoped>
.app-sidebar {
  width: 250px;
  background-color: var(--surface-card);
  border-right: 1px solid var(--surface-border);
  padding: 0;
  transition:
    background-color var(--transition-normal),
    border-color var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-border);
  flex-shrink: 0;
  height: 64px;
}

.sidebar-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #667eea;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 8px;
  flex: 1;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background-color: var(--surface-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background-color: var(--primary-color);
  color: white;
}

.nav-item i {
  font-size: 1.1rem;
}

.nav-item span {
  font-weight: 500;
}
</style>
