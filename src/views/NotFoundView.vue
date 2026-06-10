<script setup lang="ts">
import { useRouter } from "vue-router";
import Button from "primevue/button";

const router = useRouter();
</script>

<template>
  <div class="not-found">
    <div class="not-found-content">
      <span class="not-found-code">404</span>
      <h1 class="not-found-title">Page not found</h1>
      <p class="not-found-message">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button
        label="Go to Dashboard"
        icon="pi pi-home"
        @click="router.push('/')"
      />
    </div>
  </div>
</template>

<style scoped>
.not-found {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--surface-ground);
}

.not-found-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem;
}

.not-found-code {
  font-size: 6rem;
  font-weight: 700;
  line-height: 1;
  color: var(--primary-color);
  opacity: 0.4;
}

.not-found-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.not-found-message {
  color: var(--text-color-secondary);
  margin: 0;
}
</style>
