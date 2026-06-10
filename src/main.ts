import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import ConfirmationService from "primevue/confirmationservice";
import ToastService from "primevue/toastservice";
import Tooltip from "primevue/tooltip";

import App from "./App.vue";
import router from "./router";

import "primeicons/primeicons.css";
import "@/assets/styles/main.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '[data-theme="dark"]',
    },
  },
});
app.use(ConfirmationService);
app.use(ToastService);

app.directive("tooltip", Tooltip);

app.mount("#app");
