<script setup lang="ts">
import ProgressSpinner from "primevue/progressspinner";
import Skeleton from "primevue/skeleton";

withDefaults(
  defineProps<{
    type?: "spinner" | "skeleton" | "dots";
    message?: string;
    size?: "small" | "medium" | "large";
    lines?: number;
    fullHeight?: boolean;
  }>(),
  {
    type: "spinner",
    size: "medium",
    lines: 3,
    fullHeight: false,
  },
);
</script>

<template>
  <div class="loading-state" :class="{ 'full-height': fullHeight }">
    <!-- Spinner Type -->
    <template v-if="type === 'spinner'">
      <ProgressSpinner
        :style="{
          width: size === 'small' ? '30px' : size === 'large' ? '60px' : '45px',
          height:
            size === 'small' ? '30px' : size === 'large' ? '60px' : '45px',
        }"
        strokeWidth="4"
        animationDuration=".8s"
      />
      <p v-if="message" class="loading-message">{{ message }}</p>
    </template>

    <!-- Skeleton Type -->
    <template v-else-if="type === 'skeleton'">
      <div class="skeleton-container">
        <Skeleton
          v-for="i in lines"
          :key="i"
          :width="i === lines ? '60%' : '100%'"
          height="1rem"
          class="skeleton-line"
        />
      </div>
    </template>

    <!-- Dots Type -->
    <template v-else-if="type === 'dots'">
      <div class="dots-container" :class="size">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
      <p v-if="message" class="loading-message">{{ message }}</p>
    </template>
  </div>
</template>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  gap: 16px;
}

.loading-state.full-height {
  min-height: 300px;
}

.loading-message {
  color: var(--text-color-secondary);
  font-size: 0.875rem;
  margin: 0;
}

.skeleton-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  border-radius: 4px;
}

.dots-container {
  display: flex;
  gap: 8px;
}

.dots-container.small .dot {
  width: 8px;
  height: 8px;
}

.dots-container.medium .dot {
  width: 12px;
  height: 12px;
}

.dots-container.large .dot {
  width: 16px;
  height: 16px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--primary-color);
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot:nth-child(1) {
  animation-delay: -0.32s;
}

.dot:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
