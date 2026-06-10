<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "primevue/usetoast";
import Card from "primevue/card";
import Password from "primevue/password";
import Button from "primevue/button";
import ProgressSpinner from "primevue/progressspinner";

// Client minimum kept stricter than the backend (which only enforces a
// non-empty password) so a value passing here never bounces back as a 422.
// If the backend tightens its policy, surface its `error` and raise this.
const MIN_PASSWORD_LENGTH = 8;

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

// The same component serves both routes; only the copy differs.
const isInvite = computed(() => route.name === "SetPassword");
const heading = computed(() =>
  isInvite.value ? "Set your password" : "Reset your password",
);
const intro = computed(() =>
  isInvite.value
    ? "Welcome to Testoria! Choose a password to finish setting up your account."
    : "Choose a new password for your account.",
);
const submitLabel = computed(() =>
  isInvite.value ? "Set password" : "Reset password",
);

const token = computed(() => (route.query.token as string) || "");

// Lifecycle of the screen: validate the token on mount, then show the form,
// an invalid-link recovery state, or a spinner.
type Status = "validating" | "valid" | "invalid";
const status = ref<Status>("validating");
const username = ref("");

const newPassword = ref("");
const confirmPassword = ref("");
const formError = ref<string | null>(null);

const passwordFieldsRef = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (!token.value) {
    status.value = "invalid";
    return;
  }

  const result = await authStore.validateResetToken(token.value);
  if (result?.valid) {
    username.value = result.username;
    status.value = "valid";
    // PrimeVue's Password adds aria-expanded/aria-haspopup to the inner
    // <input type="password">, invalid for that role. Strip after the form
    // renders (same workaround as LoginView).
    await nextTick();
    passwordFieldsRef.value?.querySelectorAll("input").forEach((input) => {
      input.removeAttribute("aria-expanded");
      input.removeAttribute("aria-haspopup");
    });
  } else {
    status.value = "invalid";
  }
});

function validate(): boolean {
  if (newPassword.value.length < MIN_PASSWORD_LENGTH) {
    formError.value = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    return false;
  }
  if (newPassword.value !== confirmPassword.value) {
    formError.value = "Passwords do not match.";
    return false;
  }
  formError.value = null;
  return true;
}

async function handleSubmit() {
  if (!validate()) return;

  try {
    await authStore.resetPassword(token.value, newPassword.value);
    toast.add({
      severity: "success",
      summary: isInvite.value ? "Password set" : "Password reset",
      detail: "You can now sign in with your new password.",
      life: 4000,
    });
    router.push("/login");
  } catch {
    // The token may have expired/been used between validation and submit.
    // Surface the server message and drop to the invalid-link state so the
    // user can request a fresh link rather than retrying a dead token.
    formError.value = authStore.error;
    status.value = "invalid";
  }
}
</script>

<template>
  <div class="auth-container">
    <Card class="auth-card">
      <template #header>
        <div class="text-center p-4">
          <h1 class="app-title">Testoria</h1>
          <p class="text-secondary mt-2">{{ heading }}</p>
        </div>
      </template>

      <template #content>
        <!-- Validating the token -->
        <div
          v-if="status === 'validating'"
          data-testid="reset-validating"
          class="state-center"
        >
          <ProgressSpinner style="width: 48px; height: 48px" />
          <p>Validating your link…</p>
        </div>

        <!-- Invalid / expired / used token -->
        <div
          v-else-if="status === 'invalid'"
          data-testid="reset-invalid"
          class="state-center"
        >
          <i class="pi pi-exclamation-triangle invalid-icon"></i>
          <p>
            This link is no longer valid — it may have expired or already been
            used.
          </p>
          <RouterLink to="/forgot-password" class="action-link">
            Request a new link
          </RouterLink>
          <RouterLink to="/login" class="back-link">Back to sign in</RouterLink>
        </div>

        <!-- Valid token: set-password form -->
        <form
          v-else
          ref="passwordFieldsRef"
          data-testid="reset-form"
          @submit.prevent="handleSubmit"
          class="p-fluid"
        >
          <p class="intro">{{ intro }}</p>

          <div class="field mb-4">
            <label for="new-password" class="block mb-2">New password</label>
            <Password
              inputId="new-password"
              data-testid="reset-password"
              v-model="newPassword"
              placeholder="Enter a new password"
              :feedback="false"
              :disabled="authStore.loading"
              toggleMask
              autocomplete="new-password"
            />
          </div>

          <div class="field mb-4">
            <label for="confirm-password" class="block mb-2"
              >Confirm password</label
            >
            <Password
              inputId="confirm-password"
              data-testid="reset-confirm"
              v-model="confirmPassword"
              placeholder="Re-enter the password"
              :feedback="false"
              :disabled="authStore.loading"
              toggleMask
              autocomplete="new-password"
            />
          </div>

          <small v-if="formError" data-testid="reset-error" class="form-error">
            {{ formError }}
          </small>

          <Button
            type="submit"
            data-testid="reset-submit"
            :label="submitLabel"
            :loading="authStore.loading"
            :disabled="!newPassword || !confirmPassword"
            class="w-full mt-2"
          />
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-card {
  width: 100%;
  max-width: 450px;
}

.app-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
}

.intro {
  margin-bottom: 24px;
  color: var(--text-secondary, #6b7280);
  line-height: 1.5;
}

.state-center {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  line-height: 1.6;
}

.invalid-icon {
  font-size: 2.5rem;
  color: var(--yellow-500, #f59e0b);
}

.form-error {
  display: block;
  color: var(--red-600, #dc2626);
  margin-bottom: 12px;
}

.action-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}

.action-link:hover {
  text-decoration: underline;
}

.back-link {
  color: var(--text-secondary, #6b7280);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.w-full {
  width: 100%;
}

.mt-2 {
  margin-top: 8px;
}

.block {
  display: block;
}

.p-fluid :deep(.p-password) {
  width: 100%;
}

.p-fluid :deep(.p-password input) {
  width: 100%;
}

/* Ensure sufficient contrast (WCAG AA 4.5:1) on the submit button — mirrors
   LoginView; PrimeVue Aura resolves label color via theme variables. */
:deep(.p-button .p-button-label) {
  color: #ffffff !important;
}
</style>
