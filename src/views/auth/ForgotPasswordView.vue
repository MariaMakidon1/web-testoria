<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import Card from "primevue/card";
import InputText from "primevue/inputtext";
import Button from "primevue/button";

const authStore = useAuthStore();

const email = ref("");
const submitted = ref(false);

async function handleSubmit() {
  if (!email.value) return;

  try {
    await authStore.forgotPassword(email.value);
  } catch {
    // No-enumeration: we show the same confirmation regardless of outcome.
    // The store still records `error` for genuine network failures, but the
    // user-facing copy stays identical so we never reveal whether the address
    // exists. A failed send is silently retriable by requesting again.
  } finally {
    submitted.value = true;
  }
}
</script>

<template>
  <div class="auth-container">
    <Card class="auth-card">
      <template #header>
        <div class="text-center p-4">
          <h1 class="app-title">Testoria</h1>
          <p class="text-secondary mt-2">Reset your password</p>
        </div>
      </template>

      <template #content>
        <div v-if="submitted" data-testid="forgot-confirmation" class="confirmation">
          <i class="pi pi-envelope confirmation-icon"></i>
          <p>
            If an account exists for <strong>{{ email }}</strong
            >, we've sent a link to reset your password. Check your inbox.
          </p>
          <RouterLink to="/login" class="back-link">Back to sign in</RouterLink>
        </div>

        <form v-else @submit.prevent="handleSubmit" class="p-fluid">
          <p class="intro">
            Enter the email associated with your account and we'll send you a
            link to reset your password.
          </p>

          <div class="field mb-4">
            <label for="email" class="block mb-2">Email</label>
            <InputText
              id="email"
              data-testid="forgot-email"
              v-model="email"
              type="email"
              placeholder="Enter your email"
              :disabled="authStore.loading"
              autocomplete="email"
            />
          </div>

          <Button
            type="submit"
            data-testid="forgot-submit"
            label="Send reset link"
            :loading="authStore.loading"
            :disabled="!email"
            class="w-full"
          />

          <div class="links">
            <RouterLink to="/login" class="back-link">Back to sign in</RouterLink>
          </div>
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

.confirmation {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  line-height: 1.6;
}

.confirmation-icon {
  font-size: 2.5rem;
  color: var(--primary-color);
}

.links {
  margin-top: 16px;
  text-align: center;
}

.back-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
}

.back-link:hover {
  text-decoration: underline;
}

.w-full {
  width: 100%;
}

.block {
  display: block;
}

.p-fluid .p-inputtext {
  width: 100%;
}

/* Ensure sufficient contrast (WCAG AA 4.5:1) on the submit button — mirrors
   LoginView; PrimeVue Aura resolves label color via theme variables. */
:deep(.p-button .p-button-label) {
  color: #ffffff !important;
}
</style>
