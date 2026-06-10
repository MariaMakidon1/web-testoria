<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import AppHeader from "@/components/common/AppHeader.vue";
import AppSidebar from "@/components/common/AppSidebar.vue";
import SkipLink from "@/components/common/SkipLink.vue";
import { useProjectSwitchRedirect } from "@/composables/useProjectSwitchRedirect";

useProjectSwitchRedirect();

defineProps<{
  fullHeight?: boolean;
}>();

const MOBILE_BREAKPOINT = 768;
const isMobile = ref(false);
const sidebarVisible = ref(true);

function checkMobile() {
  const wasMobile = isMobile.value;
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;

  // Hide sidebar when switching to mobile, show when switching to desktop
  if (isMobile.value && !wasMobile) {
    sidebarVisible.value = false;
  } else if (!isMobile.value && wasMobile) {
    sidebarVisible.value = true;
  }
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value;
}

function closeSidebarOnMobile() {
  if (isMobile.value) {
    sidebarVisible.value = false;
  }
}

onMounted(() => {
  // Initial check
  isMobile.value = window.innerWidth < MOBILE_BREAKPOINT;
  // Hide sidebar by default on mobile
  if (isMobile.value) {
    sidebarVisible.value = false;
  }

  window.addEventListener("resize", checkMobile);
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});
</script>

<template>
  <div class="app-container">
    <SkipLink targetId="main-content" />
    <div class="app-content">
      <!-- Mobile overlay -->
      <div
        v-if="isMobile && sidebarVisible"
        class="sidebar-overlay"
        @click="closeSidebarOnMobile"
      ></div>
      <AppSidebar
        v-if="sidebarVisible"
        :class="{ 'mobile-sidebar': isMobile }"
        @navigate="closeSidebarOnMobile"
      />
      <div class="main-column">
        <AppHeader @toggle-sidebar="toggleSidebar" />
        <main
          id="main-content"
          class="main-content"
          :class="{ 'full-height': fullHeight }"
        >
          <slot />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.main-column {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: var(--surface-ground);
  transition: background-color var(--transition-normal);
}

.main-content.full-height {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Mobile sidebar overlay */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 99;
}

/* Mobile sidebar positioning */
.mobile-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.15);
}

/* Responsive padding for main content */
@media (max-width: 768px) {
  .main-content {
    padding: 16px;
  }
}
</style>
