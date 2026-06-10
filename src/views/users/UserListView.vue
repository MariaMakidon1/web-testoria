<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useUsersStore } from "@/stores/users";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import ConfirmDialog from "primevue/confirmdialog";
import Textarea from "primevue/textarea";
import UserForm from "@/components/users/UserForm.vue";
import type { User, UserRole } from "@/types/auth";
import type { UserCreate, BulkCreateError } from "@/types/user";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const usersStore = useUsersStore();
const authStore = useAuthStore();
const toast = useToast();
const confirm = useConfirm();

// Search and filters
const searchQuery = ref("");
const roleFilter = ref<UserRole | "">("");

const roleOptions = [
  { label: "All Roles", value: "" },
  { label: "Admin", value: "admin" },
  { label: "Lead", value: "lead" },
  { label: "Tester", value: "tester" },
  { label: "Read Only", value: "read_only" },
  { label: "No Access", value: "no_access" },
];

// Dialogs
const showCreateDialog = ref(false);
const showBulkDialog = ref(false);
const bulkCsvText = ref("");
const bulkErrors = ref<BulkCreateError[]>([]);

// Form data
const defaultFormData = () => ({
  username: "",
  email: "",
  password: "",
  full_name: "",
  role: "tester" as UserRole,
  is_active: true,
});

const newUser = ref(defaultFormData());

// Filtered users
const filteredUsers = computed(() => {
  let list = usersStore.users;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    list = list.filter(
      (u) =>
        u.username.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query),
    );
  }

  if (roleFilter.value) {
    list = list.filter((u) => u.role === roleFilter.value);
  }

  return list;
});

onMounted(() => {
  usersStore.fetchUsers();
});

function openCreateDialog() {
  newUser.value = defaultFormData();
  showCreateDialog.value = true;
}

async function handleCreateUser() {
  if (!newUser.value.username || !newUser.value.email) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Username and email are required",
      life: 3000,
    });
    return;
  }

  try {
    await usersStore.createUser({
      // Invite-only: no password is sent. The backend emails the user an invite
      // link to set their own password (api 049).
      username: newUser.value.username,
      email: newUser.value.email,
      full_name: newUser.value.full_name || undefined,
      role: newUser.value.role,
      is_active: newUser.value.is_active,
    });
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "User created successfully",
      life: 3000,
    });
    showCreateDialog.value = false;
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to create user",
      life: 5000,
    });
  }
}

function confirmDeleteUser(user: User) {
  confirm.require({
    message: `Are you sure you want to delete "${user.username}"? This action cannot be undone.`,
    header: "Delete User",
    icon: "pi pi-exclamation-triangle",
    acceptClass: "p-button-danger",
    accept: () => handleDeleteUser(user.id),
    reject: () => {},
  });
}

async function handleDeleteUser(id: number) {
  try {
    await usersStore.deleteUser(id);
    toast.add({
      severity: "success",
      summary: "Success",
      detail: "User deleted successfully",
      life: 3000,
    });
  } catch (error) {
    const err = error as {
      response?: { status?: number; data?: { detail?: string } };
    };
    const detail =
      err.response?.status === 409
        ? "Cannot delete a user with the lead role. Reassign their role first."
        : err.response?.data?.detail || "Failed to delete user";
    toast.add({
      severity: "error",
      summary: "Error",
      detail,
      life: 5000,
    });
  }
}

async function handleBulkCreate() {
  bulkErrors.value = [];

  if (!bulkCsvText.value.trim()) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Please enter user data",
      life: 3000,
    });
    return;
  }

  const lines = bulkCsvText.value
    .trim()
    .split("\n")
    .filter((l) => l.trim());
  const users: UserCreate[] = [];
  const missingFieldRows: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const [username, email, full_name, role] = lines[i]
      .split(",")
      .map((s) => s.trim());
    if (!username || !email) {
      toast.add({
        severity: "warn",
        summary: "Validation Error",
        detail: `Row ${i + 1}: missing required field. Format: username,email,full_name,role`,
        life: 5000,
      });
      return;
    }
    if (!full_name || !role) {
      missingFieldRows.push(i + 1);
    }
    // Invite-only: no password column. Each user gets an email invite link.
    users.push({
      username,
      email,
      full_name: full_name || undefined,
      role: (role as UserRole) || "tester",
    });
  }

  if (users.length > 100) {
    toast.add({
      severity: "warn",
      summary: "Limit Exceeded",
      detail: "Maximum 100 users per bulk operation",
      life: 3000,
    });
    return;
  }

  if (missingFieldRows.length > 0) {
    toast.add({
      severity: "warn",
      summary: "Missing Fields",
      detail: `Row${missingFieldRows.length > 1 ? "s" : ""} ${missingFieldRows.join(", ")}: missing full_name or role (defaults will be used)`,
      life: 5000,
    });
  }

  try {
    const result = await usersStore.bulkCreateUsers({ users });
    const created = result.created ?? 0;
    const errors = result.errors ?? [];

    if (errors.length === 0 && created > 0) {
      toast.add({
        severity: "success",
        summary: "Success",
        detail: `Created ${created} ${created === 1 ? "user" : "users"}`,
        life: 3000,
      });
      await usersStore.fetchUsers();
      showBulkDialog.value = false;
      bulkCsvText.value = "";
      bulkErrors.value = [];
    } else if (created > 0 && errors.length > 0) {
      toast.add({
        severity: "warn",
        summary: "Partial Success",
        detail: `Created ${created}, ${errors.length} failed`,
        life: 5000,
      });
      bulkErrors.value = errors;
      await usersStore.fetchUsers();
    } else {
      toast.add({
        severity: "error",
        summary: "Failed",
        detail: `All ${errors.length} rows failed`,
        life: 5000,
      });
      bulkErrors.value = errors;
    }
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Bulk creation failed",
      life: 5000,
    });
  }
}

async function handleExport(format: "csv" | "excel") {
  try {
    const blob = await usersStore.exportUsers(format);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users.${format === "excel" ? "xlsx" : "csv"}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Error",
      detail: err.response?.data?.detail || "Failed to export users",
      life: 5000,
    });
  }
}

function viewUser(event: { data: User }) {
  router.push(`/users/${event.data.id}`);
}

function getRoleSeverity(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: "danger",
    lead: "warn",
    tester: "info",
    read_only: "secondary",
    no_access: "contrast",
  };
  return map[role] || "info";
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}
</script>

<template>
  <DefaultLayout>
    <ConfirmDialog />
    <div class="user-list-view">
      <div class="page-header">
        <h1>User Management</h1>
        <div v-if="authStore.canManageUsers" class="header-actions">
          <Button
            label="Export CSV"
            icon="pi pi-download"
            severity="secondary"
            text
            @click="handleExport('csv')"
          />
          <Button
            label="Export Excel"
            icon="pi pi-file-excel"
            severity="secondary"
            text
            @click="handleExport('excel')"
          />
          <Button
            label="Bulk Create"
            icon="pi pi-users"
            severity="secondary"
            text
            @click="showBulkDialog = true"
          />
          <Button
            label="Create User"
            icon="pi pi-plus"
            @click="openCreateDialog"
          />
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="filters-bar">
        <span class="p-input-icon-left flex-grow">
          <i class="pi pi-search" />
          <InputText
            v-model="searchQuery"
            placeholder="Search users..."
            class="w-full"
          />
        </span>
        <Select
          v-model="roleFilter"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          placeholder="Filter by role"
          style="min-width: 160px"
        />
      </div>

      <DataTable
        :value="filteredUsers"
        :loading="usersStore.loading"
        striped-rows
        @row-click="viewUser"
        class="mt-4"
        responsive-layout="scroll"
        :row-hover="true"
      >
        <Column field="username" header="Username" sortable />
        <Column field="email" header="Email" sortable />
        <Column field="full_name" header="Full Name" sortable>
          <template #body="{ data }">
            {{ data.full_name || "-" }}
          </template>
        </Column>
        <Column field="role" header="Role" sortable style="width: 120px">
          <template #body="{ data }">
            <Tag :value="data.role" :severity="getRoleSeverity(data.role)" />
          </template>
        </Column>
        <Column field="is_active" header="Status" style="width: 100px">
          <template #body="{ data }">
            <Tag
              :value="data.is_active ? 'Active' : 'Inactive'"
              :severity="data.is_active ? 'success' : 'secondary'"
            />
          </template>
        </Column>
        <Column
          field="created_at"
          header="Created"
          sortable
          style="width: 120px"
        >
          <template #body="{ data }">
            {{ formatDate(data.created_at) }}
          </template>
        </Column>
        <Column
          v-if="authStore.canManageUsers"
          header="Actions"
          style="width: 80px"
        >
          <template #body="{ data }">
            <div class="action-buttons">
              <!-- Only an admin may delete an admin (Lead capped at Lead). -->
              <Button
                v-if="authStore.isAdmin || data.role !== 'admin'"
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                @click.stop="confirmDeleteUser(data)"
                v-tooltip.left="'Delete'"
              />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-users"></i>
            <p>No users found</p>
            <Button
              v-if="authStore.canManageUsers"
              label="Create a user"
              icon="pi pi-plus"
              @click="openCreateDialog"
            />
          </div>
        </template>
      </DataTable>

      <!-- Create Dialog -->
      <Dialog
        v-model:visible="showCreateDialog"
        header="Create New User"
        :modal="true"
        :style="{ width: '500px' }"
      >
        <UserForm ref="userFormRef" v-model="newUser" />

        <template #footer>
          <Button label="Cancel" text @click="showCreateDialog = false" />
          <Button label="Create" icon="pi pi-plus" @click="handleCreateUser" />
        </template>
      </Dialog>

      <!-- Bulk Create Dialog -->
      <Dialog
        v-model:visible="showBulkDialog"
        header="Bulk Create Users"
        :modal="true"
        :style="{ width: '600px' }"
      >
        <div class="bulk-dialog-content">
          <p class="bulk-instructions">
            Enter one user per line (<code>username</code> and
            <code>email</code> required):<br />
            <code>username,email,full_name,role</code>
          </p>
          <p class="bulk-hint">
            Each user is emailed an invite link to set their own password — no
            passwords here. Valid roles: lead, tester, read_only, no_access
            (admin can only be assigned by an admin). Max 100 users. Do not use
            commas inside field values.
          </p>
          <div v-if="bulkErrors.length" class="bulk-error-panel">
            <strong>Failed rows:</strong>
            <ul>
              <li v-for="(err, i) in bulkErrors" :key="i">
                Row {{ err.index + 1 }}<template v-if="err.email">
                  ({{ err.email }})</template
                >: {{ err.detail }}
              </li>
            </ul>
          </div>
          <Textarea
            v-model="bulkCsvText"
            rows="10"
            class="w-full"
            placeholder="john,john@example.com,John Doe,tester
jane,jane@example.com,Jane Smith,lead"
          />
        </div>

        <template #footer>
          <Button
            label="Cancel"
            text
            @click="
              showBulkDialog = false;
              bulkErrors = [];
            "
          />
          <Button
            label="Create Users"
            icon="pi pi-check"
            @click="handleBulkCreate"
          />
        </template>
      </Dialog>
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

.page-header h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filters-bar {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.flex-grow {
  flex-grow: 1;
}

.w-full {
  width: 100%;
}

.action-buttons {
  display: flex;
  gap: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px;
  color: var(--text-muted);
}

.empty-state i {
  font-size: 3rem;
  margin-bottom: 16px;
}

.empty-state p {
  margin-bottom: 16px;
}

.bulk-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bulk-instructions {
  margin: 0;
  line-height: 1.6;
}

.bulk-instructions code {
  background: var(--surface-hover);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.9em;
}

.bulk-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85em;
}

.bulk-error-panel {
  background: color-mix(in srgb, var(--danger-color) 12%, var(--surface-card));
  border: 1px solid var(--danger-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.85rem;
  max-height: 120px;
  overflow-y: auto;
  color: var(--text-color);
}

.bulk-error-panel strong {
  color: var(--danger-color);
}

.bulk-error-panel ul {
  margin: 4px 0 0 0;
  padding-left: 16px;
}

.bulk-error-panel li {
  color: var(--text-color);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .page-header h1 {
    font-size: 22px;
  }

  .header-actions {
    flex-wrap: wrap;
  }

  .filters-bar {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
