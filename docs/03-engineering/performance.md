# Performance

Performance considerations and patterns for the Testoria frontend.

---

## Bundle splitting

All route components use lazy imports (`() => import('@/views/...')`). Vite automatically code-splits on dynamic imports, so each view is loaded on first navigation rather than on initial page load.

Heavy libraries (ExcelJS, jsPDF) are dynamically imported inside composable functions:

```ts
// In useExcelExport.ts
const [{ default: ExcelJS }, { saveAs }] = await Promise.all([
  import('exceljs'),
  import('file-saver')
])
```

This keeps them out of the initial bundle and loads them only when a user triggers an export.

---

## Pagination

All list views use server-side pagination via `PaginatedResponse<T>`. Never load all records at once. Store state includes `pagination: { page, pageSize, total }`. Change `pageSize` with care — large pages increase API response time and rendering time.

---

## Reactivity

- Prefer `ref` for primitives, `reactive` for objects where you need destructuring without losing reactivity.
- Use `storeToRefs(store)` when destructuring store state in components — prevents silent reactivity loss.
- Use `computed` for derived values — computed results are cached and only recomputed when deps change.
- Avoid heavy computations directly in templates — move to `computed`.
- `shallowRef`/`shallowReactive` for large arrays that don't need deep reactivity (e.g., chart datasets).

---

## Virtual scrolling

For very long lists (1000+ items), consider PrimeVue's `DataTable` with `virtualScrollerOptions` or the `<VirtualScroller>` component. Currently not implemented but the `<DataTableWrapper>` component can be extended to support it.

---

## Image / attachment handling

Attachments are stored server-side. The `file_path` field returned by the API is the URL to the stored file. Avoid rendering base64 images for large files.

---

## Chart performance

- Register only the Chart.js components you use (not `...registerables`).
- Use `maintainAspectRatio: false` with a CSS-defined container height rather than fixed `width`/`height` props.
- For frequently updating charts (live data), use `chart.update()` rather than destroying and recreating.

---

## API request deduplication

If a user triggers multiple rapid fetches, consider debouncing filter changes:

```ts
import { debounce } from 'lodash-es'

const debouncedFetch = debounce(() => store.fetchTestCases(projectId.value), 300)
watch(filters, debouncedFetch)
```

`lodash-es` is already a project dependency.

---

## Vite build optimizations

The production build uses `vue-tsc --build --force && vite build`. Vite's Rollup bundler:
- Tree-shakes unused exports
- Minifies JavaScript and CSS
- Generates content-hashed filenames for long-term caching

The host nginx vhost (`deploy/web.vhost.conf`) caches static assets for 1 year (content-hashed filenames, `Cache-Control: public, immutable`) and enables gzip compression.
