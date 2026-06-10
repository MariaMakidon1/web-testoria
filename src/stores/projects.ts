import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectStats,
  ProjectStatsBulkParams,
  ProjectStatsItem,
} from "@/types/project";
import * as projectsApi from "@/api/projects";
import type { ProjectFilters } from "@/api/projects";
import { saveToStorage, loadFromStorage } from "@/utils/localStorage";

const SELECTED_PROJECT_KEY = "selected_project_id";

export const useProjectsStore = defineStore("projects", () => {
  const projects = ref<Project[]>([]);
  const currentProject = ref<Project | null>(null);
  const projectStats = ref<ProjectStats | null>(null);
  const bulkStats = ref<ProjectStatsItem[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 0,
  });

  // Global selected project (persisted)
  const selectedProjectId = ref<number | null>(
    loadFromStorage<number | null>(SELECTED_PROJECT_KEY, null),
  );

  const selectedProject = computed(() => {
    if (!selectedProjectId.value) return null;
    return projects.value.find((p) => p.id === selectedProjectId.value) || null;
  });

  function setSelectedProject(projectId: number | null) {
    selectedProjectId.value = projectId;
    saveToStorage(SELECTED_PROJECT_KEY, projectId);
  }

  let fetchProjectsPromise: Promise<void> | null = null;

  async function fetchProjects(filters: ProjectFilters = {}) {
    // Deduplicate concurrent calls with no filters
    const hasFilters = Object.keys(filters).length > 0;
    if (!hasFilters && fetchProjectsPromise) {
      return fetchProjectsPromise;
    }

    const doFetch = async () => {
      loading.value = true;
      error.value = null;
      try {
        const response = await projectsApi.getProjects({
          ...filters,
          page: filters.page ?? pagination.value.page,
          page_size: filters.page_size ?? pagination.value.page_size,
        });
        projects.value = response.items;
        pagination.value = {
          total: response.total,
          page: response.page,
          page_size: response.page_size,
          total_pages: response.total_pages,
        };
      } catch (e) {
        error.value = "Failed to load projects";
        throw e;
      } finally {
        loading.value = false;
        fetchProjectsPromise = null;
      }
    };

    const promise = doFetch();
    if (!hasFilters) {
      fetchProjectsPromise = promise;
    }
    return promise;
  }

  async function fetchProject(id: number) {
    loading.value = true;
    error.value = null;
    try {
      currentProject.value = await projectsApi.getProject(id);
    } catch (e) {
      error.value = "Failed to load project";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createProject(data: ProjectCreate) {
    error.value = null;
    const project = await projectsApi.createProject(data);
    projects.value.unshift(project);
    return project;
  }

  async function updateProject(id: number, data: ProjectUpdate) {
    error.value = null;
    const updated = await projectsApi.updateProject(id, data);
    const index = projects.value.findIndex((p) => p.id === id);
    if (index !== -1) {
      projects.value[index] = updated;
    }
    if (currentProject.value?.id === id) {
      currentProject.value = updated;
    }
    return updated;
  }

  async function deleteProject(id: number) {
    await projectsApi.deleteProject(id);
    projects.value = projects.value.filter((p) => p.id !== id);
    if (currentProject.value?.id === id) {
      currentProject.value = null;
    }
  }

  async function fetchProjectStats(id: number) {
    error.value = null;
    try {
      projectStats.value = await projectsApi.getProjectStats(id);
    } catch (e) {
      error.value = "Failed to load project stats";
      throw e;
    }
  }

  async function fetchBulkStats(params: ProjectStatsBulkParams = {}) {
    error.value = null;
    try {
      const response = await projectsApi.getProjectStatsBulk(params);
      bulkStats.value = response.items;
      return response;
    } catch (e) {
      error.value = "Failed to load project stats";
      throw e;
    }
  }

  function clearCurrentProject() {
    currentProject.value = null;
    projectStats.value = null;
  }

  return {
    projects,
    currentProject,
    projectStats,
    bulkStats,
    loading,
    error,
    pagination,
    selectedProjectId,
    selectedProject,
    setSelectedProject,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    fetchProjectStats,
    fetchBulkStats,
    clearCurrentProject,
  };
});
