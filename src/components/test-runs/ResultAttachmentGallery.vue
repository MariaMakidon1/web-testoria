<script setup lang="ts">
import { computed, ref } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import type { Attachment } from "@/types/testResult";

const props = withDefaults(
  defineProps<{
    attachments: Attachment[];
    maxPreview?: number;
  }>(),
  { maxPreview: 6 },
);

const emit = defineEmits<{
  (e: "reload-requested"): void;
}>();

// Tracks attachment ids whose presigned URL returned a load error so the
// "reload images" affordance can appear without flipping the whole gallery
// into an error state.
const brokenIds = ref<Set<number>>(new Set());

const images = computed(() =>
  props.attachments.filter((a) => a.mime_type?.startsWith("image/")),
);
const preview = computed(() => images.value.slice(0, props.maxPreview));
const overflow = computed(() =>
  Math.max(0, images.value.length - props.maxPreview),
);

const lightboxOpen = ref(false);
const lightboxIndex = ref(0);

function openLightbox(idx: number) {
  lightboxIndex.value = idx;
  lightboxOpen.value = true;
}

function handleImgError(attachmentId: number) {
  brokenIds.value = new Set([...brokenIds.value, attachmentId]);
}

const anyBroken = computed(() => brokenIds.value.size > 0);

function requestReload() {
  brokenIds.value = new Set();
  emit("reload-requested");
}

const current = computed(() => preview.value[lightboxIndex.value] || null);
</script>

<template>
  <div v-if="images.length > 0" class="attachment-gallery">
    <div class="gallery-strip">
      <button
        v-for="(att, idx) in preview"
        :key="att.id"
        type="button"
        class="gallery-item"
        :aria-label="`Open ${att.filename}`"
        @click="openLightbox(idx)"
      >
        <img
          :src="att.url"
          :alt="att.filename"
          loading="lazy"
          @error="handleImgError(att.id)"
        />
      </button>
      <div v-if="overflow > 0" class="gallery-more">+{{ overflow }}</div>
    </div>
    <div v-if="anyBroken" class="gallery-reload">
      <span>Some screenshots failed to load (URL may have expired).</span>
      <Button
        label="Reload images"
        icon="pi pi-refresh"
        size="small"
        severity="secondary"
        text
        @click="requestReload"
      />
    </div>

    <Dialog
      v-model:visible="lightboxOpen"
      modal
      dismissable-mask
      :header="current?.filename || 'Screenshot'"
      :style="{ maxWidth: '90vw', maxHeight: '90vh' }"
    >
      <div class="lightbox-container" v-if="current">
        <img
          :src="current.url"
          :alt="current.filename"
          class="lightbox-image"
        />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.attachment-gallery {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gallery-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gallery-item {
  width: 120px;
  height: 80px;
  padding: 0;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-card);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.1s ease;
}

.gallery-item:hover {
  transform: scale(1.02);
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gallery-more {
  width: 120px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--surface-border);
  border-radius: 6px;
  color: var(--text-color-secondary);
  font-weight: 600;
}

.gallery-reload {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

.lightbox-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.lightbox-image {
  max-width: 85vw;
  max-height: 80vh;
  object-fit: contain;
}
</style>
