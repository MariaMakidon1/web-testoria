<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUsersStore } from "@/stores/users";
import { useToast } from "primevue/usetoast";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Button from "primevue/button";
import UserForm from "@/components/users/UserForm.vue";
import type { UserRole } from "@/types/auth";
import type { UserUpdate } from "@/types/user";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const usersStore = useUsersStore();
const toast = useToast();

const authStore = useAuthStore();

const userId = Number(route.params.id);
const editing = ref(false);

// Lead+Admin can edit users, but only an admin may edit an admin (Lead capped
// at Lead — mirrors the backend ceiling in api plan 049).
const canEdit = computed(
  () =>
    authStore.canManageUsers &&
    (authStore.isAdmin || usersStore.currentUser?.role !== "admin"),
);

const formData = ref({
  username: "",
  email: "",
  full_name: "",
  password: "",
  role: "tester" as UserRole,
  is_active: true,
});

onMounted(async () => {
  try {
    await usersStore.fetchUser(userId);
    if (usersStore.currentUser) {
      formData.value = {
        username: usersStore.currentUser.username,
        email: usersStore.currentUser.email,
        full_name: usersStore.currentUser.full_name || "",
        password: "",
        role: usersStore.currentUser.role,
        is_active: usersStore.currentUser.is_active,
      };
    }
  } catch {
    toast.add({
      severity: "error",
      summary: "Error",
      detail: "Failed to load user",
      life: 5000,
    });
    router.push("/users");
  }
});

async function handleSave() {
  try {
    const updateData: UserUpdate = {
      email: formData.value.email,
      full_name: formData.value.full_name || undefined,
      role: formData.value.role,
      is_active: formData.value.is_active,
    };
    const passwordChanged = formData.value.password.trim().length > 0;
    if (passwordChanged) {
      updateData.password = formData.value.password;
    }
    await usersStore.updateUser(userId, updateData);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: passwordChanged
        ? "User updated and password changed successfully"
        : "User updated successfully",
      life: 3000,
    });
    editing.value = false;
    formData.value.password = "";
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to update user",
      life: 5000,
    });
  }
}

function cancelEdit() {
  if (usersStore.currentUser) {
    formData.value = {
      username: usersStore.currentUser.username,
      email: usersStore.currentUser.email,
      full_name: usersStore.currentUser.full_name || "",
      password: "",
      role: usersStore.currentUser.role,
      is_active: usersStore.currentUser.is_active,
    };
  }
  editing.value = false;
}
</script>

<template>
  <DefaultLayout>
    <div class="user-detail-view">
      <div class="page-header">
        <div class="header-left">
          <Button
            icon="pi pi-arrow-left"
            text
            rounded
            @click="router.push('/users')"
          />
          <h1>{{ usersStore.currentUser?.username || "User Detail" }}</h1>
        </div>
        <div class="header-actions">
          <template v-if="!editing">
            <Button
              v-if="canEdit"
              label="Edit"
              icon="pi pi-pencil"
              @click="editing = true"
            />
          </template>
          <template v-else>
            <Button label="Cancel" text @click="cancelEdit" />
            <Button label="Save" icon="pi pi-check" @click="handleSave" />
          </template>
        </div>
      </div>

      <div v-if="usersStore.loading" class="loading-state">
        <i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
      </div>

      <div v-else-if="usersStore.currentUser" class="user-content">
        <div class="form-card">
          <UserForm v-model="formData" :is-edit="true" :disabled="!editing" />
        </div>

        <div class="user-meta">
          <div class="meta-item">
            <span class="meta-label">User ID</span>
            <span class="meta-value">{{ usersStore.currentUser.id }}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Created</span>
            <span class="meta-value">{{
              new Date(usersStore.currentUser.created_at).toLocaleString()
            }}</span>
          </div>
          <div v-if="usersStore.currentUser.updated_at" class="meta-item">
            <span class="meta-label">Last Updated</span>
            <span class="meta-value">{{
              new Date(usersStore.currentUser.updated_at).toLocaleString()
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.user-content {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
}

.form-card {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 24px;
}

.user-meta {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: fit-content;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 0.85em;
  color: var(--text-muted);
  font-weight: 500;
}

.meta-value {
  font-size: 0.95em;
}

@media (max-width: 768px) {
  .user-content {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .page-header h1 {
    font-size: 22px;
  }
}
</style>
