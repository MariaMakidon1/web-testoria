<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTestCasesStore } from "@/stores/testCases";
import {
  PRIORITY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  getPrioritySeverity,
} from "@/types/testCase";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import Tag from "primevue/tag";
import ConfirmDialog from "primevue/confirmdialog";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const testCasesStore = useTestCasesStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

const testCaseId = Number(route.params.id);

onMounted(() => {
  testCasesStore.fetchTestCase(testCaseId);
});

function confirmDelete() {
  const tc = testCasesStore.currentTestCase;
  if (!tc) return;
  confirm.require({
    message: `Are you sure you want to delete "${tc.title}"? This action cannot be undone.`,
    header: "Delete Test Case",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => handleDelete(),
    reject: () => {},
  });
}

async function handleDelete() {
  try {
    await testCasesStore.deleteTestCase(testCaseId);
    toast.add({
      severity: "success",
      summary: "Deleted",
      detail: "Test case deleted successfully",
      life: 3000,
    });
    router.back();
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to delete test case",
      life: 5000,
    });
  }
}
</script>

<template>
  <DefaultLayout>
    <ConfirmDialog />
    <div class="test-case-detail-view">
      <div class="page-header">
        <div>
          <Button
            icon="pi pi-arrow-left"
            text
            @click="router.back()"
            label="Back"
          />
          <h1 v-if="testCasesStore.currentTestCase">
            <span class="test-case-id"
              >#{{ testCasesStore.currentTestCase.id }}</span
            >
            {{ testCasesStore.currentTestCase.title }}
          </h1>
        </div>
        <div class="header-actions">
          <Button
            v-if="authStore.isProjectManager"
            label="Edit"
            icon="pi pi-pencil"
            @click="router.push(`/test-cases/${testCaseId}/edit`)"
          />
          <Button
            v-if="authStore.canManageTests"
            label="Delete"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="confirmDelete"
          />
        </div>
      </div>

      <div v-if="testCasesStore.currentTestCase" class="test-case-content">
        <Card>
          <template #title>Details</template>
          <template #content>
            <div class="details-grid">
              <div class="detail-item">
                <span class="detail-label">Priority</span>
                <Tag
                  :value="
                    PRIORITY_LABELS[testCasesStore.currentTestCase.priority]
                  "
                  :severity="
                    getPrioritySeverity(testCasesStore.currentTestCase.priority)
                  "
                />
              </div>
              <div class="detail-item">
                <span class="detail-label">Type</span>
                <span>{{
                  TYPE_LABELS[testCasesStore.currentTestCase.type]
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Status</span>
                <span>{{
                  STATUS_LABELS[testCasesStore.currentTestCase.status] ||
                  testCasesStore.currentTestCase.status
                }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Automation ID</span>
                <span class="automation-id-value">{{
                  testCasesStore.currentTestCase.automation_id || "\u2014"
                }}</span>
              </div>
            </div>
          </template>
        </Card>

        <Card class="mt-4">
          <template #title>Description</template>
          <template #content>
            <div
              v-if="testCasesStore.currentTestCase.description"
              class="tiptap-content"
              v-html="testCasesStore.currentTestCase.description"
            ></div>
            <p v-else class="empty-placeholder">No description</p>
          </template>
        </Card>

        <Card class="mt-4">
          <template #title>Preconditions</template>
          <template #content>
            <div
              v-if="testCasesStore.currentTestCase.preconditions"
              class="tiptap-content"
              v-html="testCasesStore.currentTestCase.preconditions"
            ></div>
            <p v-else class="empty-placeholder">No preconditions</p>
          </template>
        </Card>

        <Card class="mt-4">
          <template #title>Test Steps</template>
          <template #content>
            <div class="steps-list">
              <div
                v-for="(step, index) in testCasesStore.currentTestCase.steps"
                :key="index"
                class="step-item"
              >
                <div class="step-number">{{ index + 1 }}</div>
                <div class="step-content">
                  <div class="step-action">
                    <strong>Action:</strong>
                    <div class="tiptap-content" v-html="step.step"></div>
                  </div>
                  <div class="step-expected">
                    <strong>Expected:</strong>
                    <div class="tiptap-content" v-html="step.expected"></div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 8px 0 0 0;
}

.test-case-id {
  color: var(--text-color-secondary);
  font-weight: 400;
  margin-right: 6px;
}

.automation-id-value {
  word-break: break-all;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.empty-placeholder {
  color: var(--text-color-secondary);
  font-style: italic;
  margin: 0;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background-color: var(--surface-ground);
  border-radius: 8px;
}

.step-number {
  width: 32px;
  height: 32px;
  background-color: var(--primary-color);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
