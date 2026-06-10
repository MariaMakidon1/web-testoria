<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import Card from "primevue/card";
import Tag from "primevue/tag";

const authStore = useAuthStore();

const user = computed(() => authStore.user);

function getRoleSeverity(role: string) {
  const map: Record<
    string,
    "danger" | "warning" | "info" | "success" | "secondary"
  > = {
    admin: "danger",
    lead: "warning",
    tester: "info",
    read_only: "secondary",
    no_access: "secondary",
  };
  return map[role] || "info";
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    admin: "Admin",
    lead: "Lead",
    tester: "Tester",
    read_only: "Read Only",
    no_access: "No Access",
  };
  return map[role] || role;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <DefaultLayout>
    <div class="profile-view">
      <div class="page-header">
        <h1>Profile</h1>
        <p class="page-subtitle">Your account information</p>
      </div>

      <div v-if="user" class="profile-content">
        <Card class="profile-card">
          <template #content>
            <div class="profile-header">
              <div class="avatar">
                {{ user.full_name?.charAt(0) || user.username.charAt(0) }}
              </div>
              <div class="profile-name">
                <h2>{{ user.full_name || user.username }}</h2>
                <span class="username">@{{ user.username }}</span>
              </div>
              <Tag
                :value="getRoleLabel(user.role)"
                :severity="getRoleSeverity(user.role)"
              />
            </div>
          </template>
        </Card>

        <div class="details-grid">
          <Card>
            <template #title>
              <div class="card-title">
                <i class="pi pi-user"></i>
                Account Details
              </div>
            </template>
            <template #content>
              <div class="details-list">
                <div class="detail-item">
                  <span class="detail-label">Username</span>
                  <span class="detail-value">{{ user.username }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Email</span>
                  <span class="detail-value">{{ user.email }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Full Name</span>
                  <span class="detail-value">{{ user.full_name || "-" }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Role</span>
                  <span class="detail-value">
                    <Tag
                      :value="getRoleLabel(user.role)"
                      :severity="getRoleSeverity(user.role)"
                    />
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Status</span>
                  <span class="detail-value">
                    <Tag
                      :value="user.is_active ? 'Active' : 'Inactive'"
                      :severity="user.is_active ? 'success' : 'secondary'"
                    />
                  </span>
                </div>
              </div>
            </template>
          </Card>

          <Card>
            <template #title>
              <div class="card-title">
                <i class="pi pi-clock"></i>
                Activity
              </div>
            </template>
            <template #content>
              <div class="details-list">
                <div class="detail-item">
                  <span class="detail-label">Member Since</span>
                  <span class="detail-value">{{
                    formatDate(user.created_at)
                  }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Last Updated</span>
                  <span class="detail-value">{{
                    formatDate(user.updated_at)
                  }}</span>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>
  </DefaultLayout>
</template>

<style scoped>
.profile-view {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.page-subtitle {
  color: var(--text-color-secondary);
  margin: 0;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 20px;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
}

.profile-name {
  flex: 1;
}

.profile-name h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-color);
}

.username {
  color: var(--text-color-secondary);
  font-size: 0.9rem;
}

.details-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.1rem;
}

.card-title i {
  color: var(--primary-color);
}

.details-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 0.95rem;
  color: var(--text-color);
}

.detail-value :deep(.p-tag) {
  font-size: 0.8rem;
}

@media (max-width: 768px) {
  .details-grid {
    grid-template-columns: 1fr;
  }

  .profile-header {
    flex-direction: column;
    text-align: center;
  }
}
</style>
