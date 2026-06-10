<script setup lang="ts">
import { ref, computed, watch } from "vue";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Select from "primevue/select";
import ToggleSwitch from "primevue/toggleswitch";
import type { UserRole } from "@/types/auth";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();

interface UserFormData {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

const props = defineProps<{
  modelValue: UserFormData;
  isEdit?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: UserFormData];
}>();

const allRoleOptions = [
  { label: "Admin", value: "admin" as UserRole },
  { label: "Lead", value: "lead" as UserRole },
  { label: "Tester", value: "tester" as UserRole },
  { label: "Read Only", value: "read_only" as UserRole },
  { label: "No Access", value: "no_access" as UserRole },
];

// Only an Admin may assign the Admin role (Lead is capped at Lead — mirrors the
// backend ceiling in api plan 049). Hide the option for non-admins.
const roleOptions = computed(() =>
  authStore.isAdmin
    ? allRoleOptions
    : allRoleOptions.filter((o) => o.value !== "admin"),
);

const form = ref<UserFormData>({ ...props.modelValue });

watch(
  () => props.modelValue,
  (val) => {
    form.value = { ...val };
  },
  { deep: true },
);

function update<K extends keyof UserFormData>(key: K, value: UserFormData[K]) {
  form.value[key] = value;
  emit("update:modelValue", { ...form.value });
}

const isValid = computed(() => {
  if (!form.value.username || !form.value.email) return false;
  // Password is optional on create: when blank the backend creates the account
  // without a usable password and emails an invite link (plan-097 / api 048).
  return true;
});

defineExpose({ isValid });
</script>

<template>
  <div class="user-form">
    <div class="field">
      <label for="user-username">Username *</label>
      <InputText
        id="user-username"
        :model-value="form.username"
        class="w-full"
        :disabled="isEdit || disabled"
        @update:model-value="update('username', $event as string)"
      />
    </div>

    <div class="field">
      <label for="user-email">Email *</label>
      <InputText
        id="user-email"
        :model-value="form.email"
        class="w-full"
        type="email"
        :disabled="disabled"
        @update:model-value="update('email', $event as string)"
      />
    </div>

    <div class="field">
      <label for="user-fullname">Full Name</label>
      <InputText
        id="user-fullname"
        :model-value="form.full_name"
        class="w-full"
        :disabled="disabled"
        @update:model-value="update('full_name', $event as string)"
      />
    </div>

    <!-- Creation is invite-only: no password field. On edit, an admin may
         optionally set a new password directly. -->
    <div v-if="isEdit" class="field">
      <label for="user-password">New Password (leave blank to keep current)</label>
      <Password
        inputId="user-password"
        :model-value="form.password"
        :feedback="false"
        toggleMask
        class="w-full password-field"
        :disabled="disabled"
        @update:model-value="update('password', $event as string)"
      />
    </div>
    <div v-else class="field">
      <small class="field-hint">
        The user will receive an email invite link to set their own password.
      </small>
    </div>

    <div class="field">
      <label for="user-role">Role</label>
      <Select
        id="user-role"
        :model-value="form.role"
        :options="roleOptions"
        option-label="label"
        option-value="value"
        class="w-full"
        :disabled="disabled"
        @update:model-value="update('role', $event as UserRole)"
      />
    </div>

    <div class="field-toggle">
      <label for="user-active">Active</label>
      <ToggleSwitch
        id="user-active"
        :model-value="form.is_active"
        :disabled="disabled"
        @update:model-value="update('is_active', $event as boolean)"
      />
    </div>
  </div>
</template>

<style scoped>
.user-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field label {
  font-weight: 500;
}

.field-hint {
  color: var(--text-muted);
  font-size: 0.85em;
}

.field-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-toggle label {
  font-weight: 500;
}

.w-full {
  width: 100%;
}

.password-field :deep(.p-password-input) {
  width: 100%;
}

.password-field :deep(input) {
  width: 100%;
}
</style>
