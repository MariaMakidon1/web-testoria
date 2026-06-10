<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useRouter, useRoute, RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "primevue/usetoast";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Password from "primevue/password";
import Button from "primevue/button";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const toast = useToast();

const username = ref("");
const password = ref("");
const loading = ref(false);
const passwordFieldRef = ref<HTMLElement | null>(null);

// PrimeVue's Password component adds aria-expanded and aria-haspopup to the inner
// <input type="password"> element, which is invalid for that role (ARIA spec violation).
// Strip them after mount since PrimeVue sets them programmatically.
onMounted(() => {
  nextTick(() => {
    const input = passwordFieldRef.value?.querySelector("input");
    if (input) {
      input.removeAttribute("aria-expanded");
      input.removeAttribute("aria-haspopup");
    }
  });
});

async function handleLogin() {
  if (!username.value || !password.value) {
    toast.add({
      severity: "warn",
      summary: "Validation Error",
      detail: "Please enter username and password",
      life: 3000,
    });
    return;
  }

  loading.value = true;
  try {
    await authStore.login({
      username: username.value,
      password: password.value,
    });

    const redirect = (route.query.redirect as string) || "/";
    router.push(redirect);

    toast.add({
      severity: "success",
      summary: "Login Successful",
      detail: `Welcome back, ${authStore.user?.full_name || username.value}!`,
      life: 3000,
    });
  } catch (error) {
    const err = error as { response?: { data?: { detail?: string } } };
    toast.add({
      severity: "error",
      summary: "Login Failed",
      detail: err.response?.data?.detail || "Invalid credentials",
      life: 5000,
    });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-container">
    <Card class="login-card">
      <template #header>
        <div class="text-center p-4">
          <h1 class="app-title">Testoria</h1>
          <p class="text-secondary mt-2">Test Management Platform</p>
        </div>
      </template>

      <template #content>
        <form @submit.prevent="handleLogin" class="p-fluid">
          <div class="field mb-4">
            <label for="username" class="block mb-2">Username</label>
            <InputText
              id="username"
              data-testid="login-username"
              v-model="username"
              placeholder="Enter your username"
              :disabled="loading"
              autocomplete="username"
            />
          </div>

          <div ref="passwordFieldRef" class="field mb-4">
            <label for="password" class="block mb-2">Password</label>
            <Password
              inputId="password"
              data-testid="login-password"
              v-model="password"
              placeholder="Enter your password"
              :feedback="false"
              :disabled="loading"
              toggleMask
              autocomplete="current-password"
            />
          </div>

          <Button
            type="submit"
            data-testid="login-submit"
            label="Sign In"
            :loading="loading"
            class="w-full"
          />

          <div class="forgot-link-row">
            <RouterLink
              to="/forgot-password"
              data-testid="login-forgot-link"
              class="forgot-link"
            >
              Forgot password?
            </RouterLink>
          </div>
        </form>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 450px;
}

.app-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
}

.w-full {
  width: 100%;
}

.forgot-link-row {
  margin-top: 16px;
  text-align: center;
}

.forgot-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.forgot-link:hover {
  text-decoration: underline;
}

.block {
  display: block;
}

.p-fluid .p-inputtext {
  width: 100%;
}

.p-fluid :deep(.p-password) {
  width: 100%;
}

.p-fluid :deep(.p-password input) {
  width: 100%;
}

/* Ensure sufficient contrast (WCAG AA 4.5:1) on the submit button.
   !important is needed because PrimeVue Aura theme sets color via CSS variables
   that may resolve differently depending on the active palette. */
:deep(.p-button .p-button-label) {
  color: #ffffff !important;
}
</style>
