import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// On-demand chunks that should never be preloaded on the initial page load.
// These are loaded dynamically only when the user triggers an export/editor action.
// Patterns matched against chunk filenames to suppress modulepreload hints.
// These chunks are fetched on-demand (user clicks export/editor/chart),
// not on the initial page load.
const ON_DEMAND_CHUNKS = ['export', 'excel', 'jspdf', 'pdf', 'fflate', 'editor', 'charts']


// Transitive dependencies of @tiptap/prosemirror that are not matched by name alone.
const EDITOR_TRANSITIVE_DEPS = [
  'linkifyjs', 'orderedmap', 'rope-sequence', 'w3c-keyname',
  'dompurify',
]

// PrimeVue-related packages. The main library uses @primevue/* AND @primeuix/*
// (the latter scope being its lower-level primitives package).
const PRIMEVUE_SCOPES = ['primevue', '@primevue', '@primeuix', 'primeicons']

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      // Ensure pre-bundled deps target modern browsers to avoid legacy polyfills
      target: 'esnext'
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    modulePreload: {
      // Do not emit <link rel="modulepreload"> for on-demand chunks.
      // They are fetched dynamically at the point of use, not on initial page load.
      resolveDependencies: (_filename, deps) =>
        deps.filter(dep => !ON_DEMAND_CHUNKS.some(name =>
          dep.includes('/' + name + '-') || dep.includes('/' + name + '.')))
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          // Specific checks MUST come before the generic vue check.
          // 'primevue', '@tiptap/vue-3', and 'vue-chartjs' all contain 'vue'
          // in their path and would be falsely caught by a broad includes('vue').

          // PrimeVue UI library (includes @primeuix/* — the lower-level primitives scope)
          if (PRIMEVUE_SCOPES.some(s => id.includes(s))) {
            return 'primevue'
          }
          // TipTap editor (on-demand) — include all prosemirror transitive deps
          if (id.includes('@tiptap') || id.includes('prosemirror') ||
              EDITOR_TRANSITIVE_DEPS.some(dep => id.includes('/' + dep + '/'))) {
            return 'editor'
          }
          // Charts (on-demand) — include Chart.js transitive deps (@kurkle/color)
          if (id.includes('chart.js') || id.includes('vue-chartjs') || id.includes('@kurkle')) {
            return 'charts'
          }
          // Export libraries (exceljs, jspdf, file-saver) are all dynamically
          // imported via composables. We intentionally do NOT assign them to a
          // manual chunk — Rollup's natural code-splitting keeps them (and their
          // transitive deps) out of the initial page load without risking
          // circular chunk dependencies.
          // Utilities
          if (id.includes('lodash') || id.includes('date-fns')) {
            return 'utils'
          }
          // HTTP client
          if (id.includes('axios')) {
            return 'axios'
          }
          // Vue core — use path-segment checks to avoid matching 'primevue' etc.
          if (id.includes('/vue/') || id.includes('/@vue/') || id.includes('/pinia/') || id.includes('/vue-router/')) {
            return 'vue-vendor'
          }
          // Remaining node_modules: let Rollup place them naturally.
          // Transitive deps of on-demand libraries (exceljs, jspdf) will be
          // code-split alongside their consumers rather than forced into a
          // shared vendor chunk that gets preloaded on every page.
        }
      }
    }
  }
})
