import { defineStore } from "pinia";
import { ref } from "vue";
import type {
  CrossProjectReportAnalytics,
  CrossProjectReportAnalyticsParams,
  ProjectReportAnalytics,
  ReportAnalyticsParams,
} from "@/types/report";
import * as reportsApi from "@/api/reports";

export const useReportsStore = defineStore("reports", () => {
  const analytics = ref<ProjectReportAnalytics | null>(null);
  const crossProjectAnalytics = ref<CrossProjectReportAnalytics | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchReportAnalytics(
    projectId: number,
    params: ReportAnalyticsParams = {},
  ) {
    loading.value = true;
    error.value = null;
    try {
      analytics.value = await reportsApi.getProjectReportAnalytics(
        projectId,
        params,
      );
    } catch (e) {
      error.value = "Failed to load report analytics";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchCrossProjectReportAnalytics(
    params: CrossProjectReportAnalyticsParams = {},
  ) {
    loading.value = true;
    error.value = null;
    try {
      crossProjectAnalytics.value =
        await reportsApi.getCrossProjectReportAnalytics(params);
    } catch (e) {
      error.value = "Failed to load report analytics";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  function clearAnalytics() {
    analytics.value = null;
    crossProjectAnalytics.value = null;
    error.value = null;
  }

  function clearProjectAnalytics() {
    analytics.value = null;
  }

  function clearCrossProjectAnalytics() {
    crossProjectAnalytics.value = null;
  }

  return {
    analytics,
    crossProjectAnalytics,
    loading,
    error,
    fetchReportAnalytics,
    fetchCrossProjectReportAnalytics,
    clearAnalytics,
    clearProjectAnalytics,
    clearCrossProjectAnalytics,
  };
});
