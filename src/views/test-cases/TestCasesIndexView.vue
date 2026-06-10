<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useProjectsStore } from "@/stores/projects";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const projectsStore = useProjectsStore();
const authStore = useAuthStore();

const loading = ref(true);
const searchQuery = ref("");

const filteredProjects = computed(() => {
  if (!searchQuery.value) {
    return projectsStore.projects;
  }
  const query = searchQuery.value.toLowerCase();
  return projectsStore.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query),
  );
});

// If a project is selected in header, redirect to its test cases
watch(
  () => projectsStore.selectedProjectId,
  (projectId) => {
    if (projectId) {
      router.push(`/projects/${projectId}/test-cases`);
    }
  },
  { immediate: true },
);

onMounted(async () => {
  // If project is already selected, redirect immediately
  if (projectsStore.selectedProjectId) {
    router.push(`/projects/${projectsStore.selectedProjectId}/test-cases`);
    return;
  }

  loading.value = true;
  try {
    await projectsStore.fetchProjects();
  } finally {
    loading.value = false;
  }
});

function navigateToTestCases(projectId: number) {
  router.push(`/projects/${projectId}/test-cases`);
}
</script>

<template>
  <DefaultLayout>
    <div class="test-cases-index">
      <div class="page-header">
        <h1>Test Cases</h1>
        <p class="subtitle">Select a project to view its test cases</p>
      </div>

      <div class="search-bar">
        <span class="p-input-icon-left">
          <i class="pi pi-search" />
          <InputText
            v-model="searchQuery"
            placeholder="Search projects..."
            class="search-input"
          />
        </span>
      </div>

      <div v-if="loading" class="loading-state">
        <i class="pi pi-spin pi-spinner"></i>
        <span>Loading projects...</span>
      </div>

      <div v-else-if="filteredProjects.length === 0" class="empty-state">
        <i class="pi pi-folder-open"></i>
        <p v-if="searchQuery">No projects match your search</p>
        <p v-else>No projects found</p>
        <Button
          v-if="!searchQuery && authStore.isProjectManager"
          label="Create Project"
          icon="pi pi-plus"
          @click="router.push('/projects')"
        />
      </div>

      <div v-else class="projects-grid">
        <Card
          v-for="project in filteredProjects"
          :key="project.id"
          class="project-card"
          @click="navigateToTestCases(project.id)"
        >
          <template #title>
            <div class="card-title">
              <i class="pi pi-folder"></i>
              <span>{{ project.name }}</span>
            </div>
          </template>
          <template #content>
            <p class="project-description">
              {{ project.description || "No description" }}
            </p>
          </template>
          <template #footer>
            <Button
              label="View Test Cases"
              icon="pi pi-list"
              size="small"
              @click.stop="navigateToTestCases(project.id)"
            />
          </template>
        </Card>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.test-cases-index {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.subtitle {
  color: var(--text-color-secondary);
  margin: 0;
}

.search-bar {
  margin-bottom: 24px;
}

.search-input {
  width: 100%;
  max-width: 400px;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  text-align: center;
}

.loading-state i,
.empty-state i {
  font-size: 3rem;
  color: var(--text-color-secondary);
  margin-bottom: 16px;
}

.loading-state span,
.empty-state p {
  font-size: 1rem;
  color: var(--text-color-secondary);
  margin: 0 0 16px 0;
}

.projects-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.project-card {
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.project-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-title i {
  color: var(--primary-color);
}

.project-description {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
