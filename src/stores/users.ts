import { defineStore } from "pinia";
import { ref } from "vue";
import type { User } from "@/types/auth";
import type {
  UserCreate,
  UserUpdate,
  UserBulkCreate,
  UserBulkResult,
  UserFilters,
} from "@/types/user";
import * as usersApi from "@/api/users";

export const useUsersStore = defineStore("users", () => {
  const users = ref<User[]>([]);
  const currentUser = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const pagination = ref({
    total: 0,
    page: 1,
    page_size: 20,
    total_pages: 0,
  });
  const filters = ref<UserFilters>({});

  async function fetchUsers(newFilters?: UserFilters) {
    loading.value = true;
    error.value = null;
    if (newFilters) {
      filters.value = { ...filters.value, ...newFilters };
    }

    try {
      const response = await usersApi.getUsers({
        ...filters.value,
        page: pagination.value.page,
        page_size: pagination.value.page_size,
      });

      users.value = response.items;
      pagination.value = {
        total: response.total,
        page: response.page,
        page_size: response.page_size,
        total_pages: response.total_pages,
      };
    } catch (e) {
      error.value = "Failed to load users";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function fetchUser(id: number) {
    loading.value = true;
    error.value = null;
    try {
      currentUser.value = await usersApi.getUser(id);
    } catch (e) {
      error.value = "Failed to load user";
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function createUser(data: UserCreate): Promise<User> {
    error.value = null;
    const user = await usersApi.createUser(data);
    users.value.unshift(user);
    pagination.value.total++;
    return user;
  }

  async function bulkCreateUsers(
    data: UserBulkCreate,
  ): Promise<UserBulkResult> {
    error.value = null;
    const result = await usersApi.bulkCreateUsers(data);
    // `created` is a count; the created rows aren't returned, so callers refetch
    // the list. Bump the total optimistically for immediate feedback.
    if (result.created > 0) {
      pagination.value.total += result.created;
    }
    return result;
  }

  async function updateUser(id: number, data: UserUpdate): Promise<User> {
    error.value = null;
    const updated = await usersApi.updateUser(id, data);
    const index = users.value.findIndex((u) => u.id === id);
    if (index !== -1) {
      users.value[index] = updated;
    }
    if (currentUser.value?.id === id) {
      currentUser.value = updated;
    }
    return updated;
  }

  async function deleteUser(id: number) {
    await usersApi.deleteUser(id);
    users.value = users.value.filter((u) => u.id !== id);
    pagination.value.total--;
    if (currentUser.value?.id === id) {
      currentUser.value = null;
    }
  }

  async function exportUsers(format: "csv" | "excel" = "csv"): Promise<Blob> {
    return await usersApi.exportUsers(format);
  }

  function setPage(page: number) {
    pagination.value.page = page;
  }

  function clearFilters() {
    filters.value = {};
    pagination.value.page = 1;
  }

  function clearCurrentUser() {
    currentUser.value = null;
  }

  return {
    users,
    currentUser,
    loading,
    error,
    pagination,
    filters,
    fetchUsers,
    fetchUser,
    createUser,
    bulkCreateUsers,
    updateUser,
    deleteUser,
    exportUsers,
    setPage,
    clearFilters,
    clearCurrentUser,
  };
});
