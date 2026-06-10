<script setup lang="ts">
defineProps<{
  targetId: string;
  label?: string;
}>();

function handleClick(event: Event) {
  event.preventDefault();
  const target = document.getElementById(
    (event.target as HTMLAnchorElement).getAttribute("href")?.slice(1) || "",
  );
  if (target) {
    target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView({ behavior: "smooth" });
  }
}
</script>

<template>
  <a :href="`#${targetId}`" class="skip-link" @click="handleClick">
    {{ label || "Skip to main content" }}
  </a>
</template>

<style scoped>
.skip-link {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: var(--primary-color);
  color: white;
  text-decoration: none;
  font-weight: 600;
  border-radius: 0 0 8px 8px;
  z-index: 10000;
  transition: top 0.2s ease;
}

.skip-link:focus {
  top: 0;
  outline: 2px solid var(--primary-400);
  outline-offset: 2px;
}
</style>
