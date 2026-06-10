<script setup lang="ts">
import { RouterView } from "vue-router";
import Toast from "primevue/toast";
import NotificationToast from "@/components/common/NotificationToast.vue";
import { usePreferencesStore } from "@/stores/preferences";

// Initialize preferences store to apply theme on startup
const preferencesStore = usePreferencesStore();
preferencesStore.applyTheme();

// Fix PrimeVue aria-hidden accessibility bug by preventing it from being set on menu items
const originalSetAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string) {
  // Prevent aria-hidden on focusable menu items (PrimeVue bug)
  if (
    name === "aria-hidden" &&
    value === "true" &&
    this.classList?.contains("p-menuitem-link")
  ) {
    return;
  }
  return originalSetAttribute.call(this, name, value);
};
</script>

<template>
  <!--
    Toast lives bottom-right (plan-090, fixes TES-74) so action-feedback
    toasts don't overlap the New Test Suite / New Test Run / Edit / Create
    buttons that all live in the top-right of page headers. Don't add fixed
    bottom-right controls (chat widget, scroll-to-top, etc.) without picking
    a different lane for the toast.
  -->
  <Toast position="bottom-right" />
  <NotificationToast />
  <RouterView />
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-primary);
}
</style>
