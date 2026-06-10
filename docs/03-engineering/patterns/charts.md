# Charts

How charts are built in Testoria using Chart.js + vue-chartjs.

---

## Libraries

- **Chart.js 4** — charting engine
- **vue-chartjs 5** — Vue 3 wrapper components (`<Bar>`, `<Doughnut>`, `<Line>`, `<Pie>`, etc.)

Used in: `views/reports/ReportDashboardView.vue` and `views/dashboard/DashboardView.vue`.

---

## Basic usage

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend, Title
} from 'chart.js'

// Register only what you use
ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

const props = defineProps<{ progress: TestRunProgress }>()

const passRateData = computed(() => ({
  labels: ['Passed', 'Failed', 'Blocked', 'Skipped'],
  datasets: [{
    data: [
      props.progress.passed,
      props.progress.failed,
      props.progress.blocked,
      props.progress.skipped
    ],
    backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#6b7280']
  }]
}))

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const }
  }
}
</script>

<template>
  <div style="height: 300px">
    <Doughnut :data="passRateData" :options="doughnutOptions" />
  </div>
</template>
```

---

## Color conventions

Use the same color palette as `RESULT_STATUS_COLORS` from `src/types/testResult.ts`:

```
Passed   → #22c55e
Failed   → #ef4444
Blocked  → #f59e0b
Skipped  → #6b7280
Retest   → #8b5cf6
Untested → #94a3b8
```

For priority-based charts, use `PRIORITY_COLORS` from `src/types/testCase.ts`.

---

## Chart types used in the app

| Chart | Use case |
|-------|----------|
| Doughnut | Pass rate breakdown (Passed/Failed/Blocked/...) |
| Bar | Test results over time, results by suite |
| Line | Trend charts (pass rate over runs) |
| Pie | Distribution charts |

---

## Responsive charts

Always wrap charts in a container with a defined height. Chart.js needs a fixed height to render:

```vue
<div class="chart-container" style="position: relative; height: 300px; width: 100%">
  <Bar :data="chartData" :options="{ responsive: true, maintainAspectRatio: false }" />
</div>
```

`maintainAspectRatio: false` + a parent with defined height is the standard pattern.

---

## Dark mode

Chart.js does not automatically respond to the Vue dark mode toggle. If dark mode is needed for chart text/grid colors, use `watch` on `uiStore.darkMode` and update chart options:

```ts
import { useUIStore } from '@/stores/ui'
import { storeToRefs } from 'pinia'

const { darkMode } = storeToRefs(useUIStore())

const chartOptions = computed(() => ({
  plugins: {
    legend: { labels: { color: darkMode.value ? '#e2e8f0' : '#1e293b' } }
  },
  scales: {
    x: { ticks: { color: darkMode.value ? '#94a3b8' : '#64748b' } },
    y: { ticks: { color: darkMode.value ? '#94a3b8' : '#64748b' } }
  }
}))
```

---

## Chart registration

Register Chart.js components once, globally in `main.ts`, or locally in the component. Avoid registering everything (`ChartJS.register(...registerables)`) — register only what you use to keep the bundle smaller.
