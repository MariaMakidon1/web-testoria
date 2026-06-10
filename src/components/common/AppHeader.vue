<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { useProjectsStore } from "@/stores/projects";
import { useRouter } from "vue-router";
import Button from "primevue/button";
import Avatar from "primevue/avatar";
import Menu from "primevue/menu";
import Select from "primevue/select";
import { ref, nextTick, onMounted, computed } from "vue";
import { useKeyboardShortcuts } from "@/composables/useAccessibility";
import KeyboardShortcutsDialog from "./KeyboardShortcutsDialog.vue";

const emit = defineEmits(["toggle-sidebar"]);
const authStore = useAuthStore();
const projectsStore = useProjectsStore();
const router = useRouter();
const userMenu = ref();

// Project dropdown options
const projectOptions = computed(() => {
  const options = [
    { id: null, name: "All Projects" },
    ...projectsStore.projects.filter((p) => !p.is_archived),
  ];
  return options;
});

const selectedProjectId = computed({
  get: () => projectsStore.selectedProjectId,
  set: (value) => projectsStore.setSelectedProject(value),
});

onMounted(() => {
  projectsStore.fetchProjects();
});

const userMenuItems = [
  {
    label: "Profile",
    icon: "pi pi-user",
    command: () => router.push("/profile"),
  },
  {
    label: "Settings",
    icon: "pi pi-cog",
    command: () => router.push("/settings"),
  },
  {
    separator: true,
  },
  {
    label: "Logout",
    icon: "pi pi-sign-out",
    command: () => handleLogout(),
  },
];

const showShortcutsDialog = ref(false);

useKeyboardShortcuts({
  "?": () => {
    showShortcutsDialog.value = true;
  },
});

async function handleLogout() {
  await authStore.logout();
  router.push("/login");
}

function toggleUserMenu(event: Event) {
  userMenu.value.toggle(event);
}

// Fix PrimeVue aria-hidden accessibility bug
function onMenuShow() {
  nextTick(() => {
    document
      .querySelectorAll('.p-menuitem-link[aria-hidden="true"]')
      .forEach((el) => {
        el.removeAttribute("aria-hidden");
      });
  });
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <Button
        icon="pi pi-bars"
        text
        rounded
        aria-label="Toggle sidebar"
        @click="emit('toggle-sidebar')"
      />
      <!-- Project Selector -->
      <div class="project-selector">
        <i class="pi pi-folder"></i>
        <Select
          v-model="selectedProjectId"
          :options="projectOptions"
          optionLabel="name"
          optionValue="id"
          placeholder="Select Project"
          class="project-dropdown"
          :class="{ 'has-selection': selectedProjectId !== null }"
          :showClear="selectedProjectId !== null"
        />
      </div>
    </div>

    <div class="header-right">
      <Button icon="pi pi-bell" text rounded aria-label="Notifications" />
      <Button
        icon="pi pi-question-circle"
        text
        rounded
        aria-label="Keyboard shortcuts"
        v-tooltip.bottom="'Keyboard shortcuts (?)'"
        @click="showShortcutsDialog = true"
      />

      <div class="user-section">
        <span class="user-name">{{
          authStore.user?.full_name || authStore.user?.username
        }}</span>
        <Avatar
          :label="
            (
              authStore.user?.full_name?.charAt(0) ||
              authStore.user?.username?.charAt(0) ||
              'U'
            ).toUpperCase()
          "
          shape="circle"
          role="button"
          tabindex="0"
          :aria-label="`User menu for ${authStore.user?.full_name || authStore.user?.username}`"
          aria-haspopup="menu"
          @click="toggleUserMenu"
          @keydown.enter="toggleUserMenu"
          @keydown.space.prevent="toggleUserMenu"
          style="cursor: pointer"
        />
        <Menu ref="userMenu" :model="userMenuItems" popup @show="onMenuShow" />
      </div>
    </div>
  </header>

  <KeyboardShortcutsDialog v-model:visible="showShortcutsDialog" />
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background-color: var(--surface-card);
  border-bottom: 1px solid var(--surface-border);
  height: 64px;
  transition:
    background-color var(--transition-normal),
    border-color var(--transition-normal);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 250px;
  flex-shrink: 0;
  padding-right: 16px;
  border-right: 1px solid var(--surface-border);
}

/* Project Selector */
.project-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-selector i {
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.project-dropdown {
  width: 350px;
}

.project-dropdown :deep(.p-dropdown-label) {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

.project-dropdown :deep(.p-dropdown-trigger) {
  width: 2rem;
}

.project-dropdown :deep(.p-dropdown-clear-icon) {
  position: relative;
  right: 8px;
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.project-dropdown :deep(.p-icon-wrapper) {
  display: flex;
  align-items: center;
}

/* Hide arrow icon when project is selected, show only clear icon */
.project-dropdown.has-selection :deep(.p-dropdown-trigger) {
  display: none;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-section :deep(.p-avatar.p-avatar-circle) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.user-section :deep(.p-avatar.p-avatar-circle > *) {
  line-height: 1;
  display: block;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

/* Mobile responsive styles */
@media (max-width: 768px) {
  .app-header {
    padding: 8px 12px;
  }

  .header-left {
    gap: 8px;
  }

  .app-title {
    font-size: 16px;
  }

  .project-selector {
    margin-left: 8px;
    padding-left: 8px;
    gap: 4px;
  }

  .project-selector i {
    display: none;
  }

  .project-dropdown {
    width: 180px;
  }

  .header-right {
    gap: 8px;
  }

  .user-section {
    gap: 8px;
  }

  .user-name {
    display: none;
  }
}

/* Extra small screens */
@media (max-width: 480px) {
  .app-title {
    display: none;
  }

  .project-selector {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
  }
}
</style>
