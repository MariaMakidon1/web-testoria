import { defineStore } from "pinia";
import { ref } from "vue";
import type { Tag } from "@/types/testCase";
import * as tagsApi from "@/api/tags";

export const useTagsStore = defineStore("tags", () => {
  const tags = ref<Tag[]>([]);
  const searchResults = ref<Tag[]>([]);
  const loading = ref(false);

  let searchRequestId = 0;

  async function fetchTags(): Promise<void> {
    loading.value = true;
    try {
      tags.value = await tagsApi.getTags();
    } finally {
      loading.value = false;
    }
  }

  async function searchTags(q: string): Promise<void> {
    const requestId = ++searchRequestId;
    try {
      const results = await tagsApi.searchTags(q);
      if (requestId === searchRequestId) {
        searchResults.value = results;
      }
    } catch {
      if (requestId === searchRequestId) {
        searchResults.value = [];
      }
    }
  }

  async function createTag(data: { name: string }): Promise<Tag> {
    const tag = await tagsApi.createTag(data);
    tags.value = [...tags.value, tag];
    return tag;
  }

  return { tags, searchResults, loading, fetchTags, searchTags, createTag };
});
