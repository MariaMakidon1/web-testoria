<script setup lang="ts">
import { useRouter } from "vue-router";
import Button from "primevue/button";

const router = useRouter();
</script>

<template>
  <div class="access-denied">
    <div class="access-denied-content">
      <span class="access-denied-code">403</span>
      <h1 class="access-denied-title">Access Denied</h1>
      <p class="access-denied-message">
        You don't have permission to access this page. Contact your
        administrator if you believe this is an error.
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
.access-denied {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--surface-ground);
}

.access-denied-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem;
}

.access-denied-code {
  font-size: 6rem;
  font-weight: 700;
  line-height: 1;
  color: var(--primary-color);
  opacity: 0.4;
}

.access-denied-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.access-denied-message {
  color: var(--text-color-secondary);
  margin: 0;
  max-width: 400px;
}
</style>
