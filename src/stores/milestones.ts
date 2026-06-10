import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  Milestone,
  MilestoneCreate,
  MilestoneUpdate,
} from "@/types/milestone";
import * as milestonesApi from "@/api/milestones";

export const useMilestonesStore = defineStore("milestones", () => {
  const milestones = ref<Milestone[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchMilestones(projectId: number) {
    loading.value = true;
    error.value = null;
    try {
      milestones.value = await milestonesApi.getMilestones(projectId);
    } catch (e) {
      error.value = "Failed to load milestones";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createMilestone(
    projectId: number,
    data: MilestoneCreate,
  ): Promise<Milestone> {
    error.value = null;
    const milestone = await milestonesApi.createMilestone(projectId, data);
    milestones.value.unshift(milestone);
    return milestone;
  }

  async function updateMilestone(
    id: number,
    data: MilestoneUpdate,
  ): Promise<Milestone> {
    error.value = null;
    const updated = await milestonesApi.updateMilestone(id, data);
    const index = milestones.value.findIndex((m) => m.id === id);
    if (index !== -1) {
      milestones.value[index] = updated;
    }
    return updated;
  }

  async function deleteMilestone(id: number) {
    await milestonesApi.deleteMilestone(id);
    milestones.value = milestones.value.filter((m) => m.id !== id);
  }

  return {
    milestones,
    loading,
    error,
    fetchMilestones,
    createMilestone,
    updateMilestone,
    deleteMilestone,
  };
});
