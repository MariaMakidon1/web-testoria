# Execution Plan: Dashboard Test Results Distribution — Leader-Line % Labels

**Date**: 2026-04-22
**Author**: gabi
**Status**: Draft

> **Lifecycle**: Save this file as `docs/04-execution/exec-plans/active/<plan-name>.md` while in progress.
> Move to `docs/04-execution/exec-plans/completed/` once all Definition of Done items are checked off.

---

## Goal

On the dashboard's **Test Results Distribution** doughnut chart, draw a short leader line out of each slice ending in a `"<label> <pct>%"` callout — so users see the percentage of each status (passed / failed / blocked / no_run) without hovering for tooltips.

---

## Context

Today, `src/components/charts/DoughnutChart.vue` wraps `vue-chartjs`'s `<Doughnut>` with only tooltips and a side legend registered (`Chart.js` plugins: `ArcElement, Tooltip, Legend`). The dashboard view at `src/views/dashboard/DashboardView.vue:513-527` renders the chart with `doughnutOptions` — no slice-level text, no leader lines.

The chart already has:
- Distribution data from `statusDistribution` (counts per status)
- Colour mapping from `RESULT_STATUS_COLORS`
- A side legend listing each status label

What the user asked for: each slice emits a short line pointing outward to a text label with the slice's percentage of the total.

This is a standard "polar/leader line" callout on a doughnut/pie chart. Chart.js v4 does not ship leader-line rendering natively; two realistic paths:

- **Path A (chosen, default):** a small custom Chart.js plugin local to `DoughnutChart.vue` that implements `afterDatasetsDraw`. For each arc: compute the outer midpoint, extend a short radial line, then a horizontal elbow, and render `"<label> <pct>%"` text. ~40 lines of code, no new dependency.
- **Path B (alternative):** add `chartjs-plugin-datalabels` for the label placement + collision handling, and a thin companion plugin just for the connector lines. More robust on crowded charts, but adds a dependency for a 4-slice maximum case.

Current dependencies (`package.json`):
- `chart.js@^4.4.1`
- `vue-chartjs@^5.3.0`

Related:
- plan-048 — status colour tokens standardised (reuse for label text colour)
- plan-050 — dashboard headline pass-rate always green
- plan-074 (in flight) — Recent Test Runs pass-rate + always-green

---

## Scope

### In scope
- Add a leader-line + `%` label to each slice of the **Test Results Distribution** doughnut on the dashboard
- Show the percentage rounded to one decimal (e.g. `50.0%`) — match the dashboard's existing pass-rate precision
- Handle very small slices (< 5% of total): still render a leader line; collision-avoid by staggering vertically if two tiny slices land on the same side (best effort — full anti-overlap is a follow-up)
- Hide the label for zero-value slices (don't render `0.0%` noise) — the status still appears in the legend so users know it's in scope
- Keep the existing side legend and tooltips intact
- Respect dark mode: label text uses a theme-aware colour (already provided via `--text-color` CSS var)
- Unit / visual smoke test: four non-zero slices render four labels; one zero slice is omitted; percentages sum to 100 (± rounding)

### Out of scope
- Other charts on the dashboard (trend line, per-project breakdown bars)
- Reports page doughnuts or pie charts (if any — none today)
- Full collision-avoidance layout for arbitrarily crowded charts (only 4 slices max here)
- Animations on the leader lines
- Configurability via props (label format / position) — add only if a second caller appears

---

## Technical approach

### Changes required

| Layer | File(s) | What changes |
|-------|---------|--------------|
| component | `src/components/charts/DoughnutChart.vue` | Register a local Chart.js plugin (`leaderLineLabelsPlugin`) in the component's setup. Plugin's `afterDatasetsDraw(chart)` iterates `chart.getDatasetMeta(0).data` (arcs); for each non-zero arc, computes the midpoint via `arc.getCenterPoint()`, reads the label from `chart.data.labels[i]` and the raw value from `chart.data.datasets[0].data[i]`; draws a 2-segment line (radial out ~10px, horizontal ~30px toward the nearest edge) and the text `"${label} ${pct}%"`. Text colour = `getComputedStyle(chart.canvas).getPropertyValue('--text-color')` or fallback `#334155`. |
| component | `src/components/charts/DoughnutChart.vue` | Add padding via `chart.options.layout.padding = { top: 24, right: 64, bottom: 24, left: 24 }` (or similar) so labels drawn outside the chart area aren't clipped. Tweak after visual check. |
| view | `src/views/dashboard/DashboardView.vue` | No change expected unless the legend needs to move. Verify the right-side legend still fits next to the chart after padding is added; if cramped, set `legend.position: "bottom"` or reduce padding on the right. |
| tests | `src/components/charts/__tests__/DoughnutChart.spec.ts` | Mount with known data; assert the plugin's draw hook is installed; use a headless canvas stub (or mock Chart.js) to verify `fillText` was called with the expected `"Passed 50.0%"` strings and that zero-value slices produce no such call. |

### Key decisions

- **Custom plugin over adding `chartjs-plugin-datalabels`.** With only 4 slices and simple formatting needs, a local plugin keeps the dependency surface small and the rendering exactly what we want. If collision handling becomes painful later, switch to the datalabels plugin — noted as a fallback in Risks.
- **Plugin lives inside `DoughnutChart.vue`, not global.** The leader-line labels are specific to this chart's use case. A global registration would affect every future doughnut / pie chart unconditionally.
- **Percentage denominator = sum of slices in this dataset**, not `total` from any external source. Keeps the plugin self-contained: `pct = value / sum(data) * 100`.
- **Rounding to 1 decimal**, same convention as `formatPassRate()` on the rest of the dashboard.
- **Zero-value slices are hidden from labels but kept in the legend.** The legend already documents the colour mapping; a leader line pointing to an empty arc segment is noise.
- **Label text follows `RESULT_STATUS_COLORS[status]`?** No — too colourful against light backgrounds. Use a single neutral text colour driven by the CSS var; the slice colour is already conveyed by the slice itself.
- **No connector styling options exposed.** Default: 1px solid, same neutral colour as the label text.

---

## Tasks

### Implementation
- [ ] Write `leaderLineLabelsPlugin` as a local const in `DoughnutChart.vue` (`afterDatasetsDraw` hook)
- [ ] Compute per-slice percentage from the dataset sum, skip zero values
- [ ] Draw a 2-segment leader line from each arc's outer midpoint
- [ ] Draw `"<label> <pct>%"` text at the line end
- [ ] Use `--text-color` CSS var (fallback `#334155`) for text + line stroke
- [ ] Register the plugin on the Chart instance (via `plugins: [leaderLineLabelsPlugin]` in the `<Doughnut>` props, or via `ChartJS.register(...)` scoped to this component only)
- [ ] Add canvas `layout.padding` so labels aren't clipped
- [ ] Verify existing side legend and tooltips still work
- [ ] Unit test with mocked canvas: four non-zero slices → four `fillText` calls with expected strings; zero-value slice → no call
- [ ] Manual smoke on dev server (light + dark mode):
  - [ ] Typical case: all four statuses with non-zero counts → four labels render outside the ring
  - [ ] One status zero (e.g. no blocked) → only three labels
  - [ ] Tiny slice (1-2%) → label still renders without overlap
  - [ ] All values zero → chart hits the existing `hasDistribution` guard and renders empty state

### Quality check (Phase 4)
- [ ] `npm run lint` passes
- [ ] `npm run test -- --run` passes
- [ ] `npm run build` passes
- [ ] `docs/05-quality/checklists/pr-checklist.md` reviewed

### Docs update (Phase 5)
- [ ] `docs/03-engineering/patterns/charts.md` — add a short note on the leader-line pattern for doughnut charts
- [ ] `docs/08-decisions/changelog.md` — short entry: dashboard doughnut shows leader-line % labels
- [ ] `docs/04-execution/tech-debt.md` — add "collision-avoidance for doughnut labels if slice count grows" as low-priority debt
- [ ] This plan moved from `active/` to `completed/`
- [ ] PR review and merge

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Two tiny slices on the same side of the chart collide | Medium | Best-effort vertical stagger in v1 (alternate label y-offset per side); if painful, switch to `chartjs-plugin-datalabels` which has built-in collision handling. Slice count is capped at 4, so collision scenarios are bounded. |
| Labels get clipped by the canvas bounds at small chart widths | Medium | Add generous `layout.padding`; wrap labels (e.g. drop status name, keep `%`) under a configurable width threshold if needed |
| Dark-mode CSS var resolution at draw time is stale after theme toggle | Low | Chart.js redraws on container resize and legend click; if theme toggle doesn't trigger a redraw, add a watcher on the theme store that calls `chart.update()` |
| Plugin rendering order: labels drawn before arcs in some edge cases | Very low | Using `afterDatasetsDraw` guarantees arcs are in place; verified hook order in Chart.js v4 |
| Adding layout padding shifts the visible ring slightly and looks off next to the adjacent charts | Low | Visual check during implementation; adjust padding + legend position together |
| Test coverage requires mocking Chart.js' canvas — brittle | Medium | Use `vi.spyOn(CanvasRenderingContext2D.prototype, 'fillText')` in JSDOM; if too flaky, reduce unit-test depth and rely on Playwright visual snapshot for a follow-up |

---

## Definition of done

- [ ] Each non-zero slice of the dashboard's Test Results Distribution doughnut has a short leader line terminating in `"<Label> <n.n>%"`
- [ ] Zero-value slices emit no leader line
- [ ] Percentages sum to ~100% (within rounding)
- [ ] Side legend and hover tooltips still function
- [ ] Labels are legible in both light and dark modes
- [ ] Chart area is padded enough that no label is clipped at the standard dashboard layout widths
- [ ] Unit test verifies the plugin draws expected strings for non-zero slices and skips zero slices
- [ ] `npm run lint`, `npm run test -- --run`, `npm run build` all green
- [ ] Changelog entry added
