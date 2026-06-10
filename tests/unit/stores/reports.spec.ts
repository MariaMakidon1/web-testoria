import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useReportsStore } from '@/stores/reports'
import type {
  CrossProjectReportAnalytics,
  ProjectReportAnalytics
} from '@/types/report'

vi.mock('@/api/reports', () => ({
  getProjectReportAnalytics: vi.fn(),
  getCrossProjectReportAnalytics: vi.fn()
}))

import * as reportsApi from '@/api/reports'

const makeAnalytics = (
  overrides: Partial<ProjectReportAnalytics> = {}
): ProjectReportAnalytics => ({
  project_id: 1,
  date_from: null,
  date_to: null,
  summary: {
    total_test_cases: 10,
    total_test_suites: 3,
    total_test_runs: 2,
    active_runs: 1,
    overall_pass_rate: 75,
    total_results: 20,
    result_distribution: { passed: 15, failed: 5 }
  },
  runs: [],
  test_case_distribution: {
    by_priority: { critical: 1, high: 2, medium: 4, low: 3 },
    by_type: { manual: 7, automated: 3 },
    by_automation: { automated: 3, manual: 7 }
  },
  trend: [],
  ...overrides
})

describe('Reports Store', () => {
  let store: ReturnType<typeof useReportsStore>

  beforeEach(() => {
    store = useReportsStore()
    store.clearAnalytics()
  })

  describe('initial state', () => {
    it('starts with no analytics', () => {
      expect(store.analytics).toBeNull()
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })

    it('starts with no error', () => {
      expect(store.error).toBeNull()
    })
  })

  describe('fetchReportAnalytics', () => {
    it('populates analytics from API response', async () => {
      const data = makeAnalytics()
      vi.mocked(reportsApi.getProjectReportAnalytics).mockResolvedValueOnce(data)

      await store.fetchReportAnalytics(1)

      expect(store.analytics).toEqual(data)
    })

    it('passes params through to the API', async () => {
      vi.mocked(reportsApi.getProjectReportAnalytics).mockResolvedValueOnce(makeAnalytics())

      await store.fetchReportAnalytics(1, {
        date_from: '2026-01-01T00:00:00Z',
        date_to: '2026-02-01T00:00:00Z'
      })

      expect(reportsApi.getProjectReportAnalytics).toHaveBeenCalledWith(1, {
        date_from: '2026-01-01T00:00:00Z',
        date_to: '2026-02-01T00:00:00Z'
      })
    })

    it('sets loading=true during fetch and false after', async () => {
      let resolveFn: (value: ProjectReportAnalytics) => void = () => {}
      const pending = new Promise<ProjectReportAnalytics>((resolve) => {
        resolveFn = resolve
      })
      vi.mocked(reportsApi.getProjectReportAnalytics).mockReturnValueOnce(pending)

      const promise = store.fetchReportAnalytics(1)
      expect(store.loading).toBe(true)

      resolveFn(makeAnalytics())
      await promise

      expect(store.loading).toBe(false)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(reportsApi.getProjectReportAnalytics).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(store.fetchReportAnalytics(1)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load report analytics')
      expect(store.loading).toBe(false)
    })

    it('clears prior error on a new successful fetch', async () => {
      vi.mocked(reportsApi.getProjectReportAnalytics).mockRejectedValueOnce(
        new Error('Network error')
      )
      await expect(store.fetchReportAnalytics(1)).rejects.toThrow()
      expect(store.error).toBe('Failed to load report analytics')

      vi.mocked(reportsApi.getProjectReportAnalytics).mockResolvedValueOnce(makeAnalytics())
      await store.fetchReportAnalytics(1)

      expect(store.error).toBeNull()
    })
  })

  describe('clearAnalytics', () => {
    it('resets analytics and error to null', async () => {
      vi.mocked(reportsApi.getProjectReportAnalytics).mockResolvedValueOnce(makeAnalytics())
      await store.fetchReportAnalytics(1)
      expect(store.analytics).not.toBeNull()

      store.clearAnalytics()

      expect(store.analytics).toBeNull()
      expect(store.error).toBeNull()
    })
  })

  describe('fetchCrossProjectReportAnalytics', () => {
    const makeCross = (
      overrides: Partial<CrossProjectReportAnalytics> = {}
    ): CrossProjectReportAnalytics => ({
      project_ids: null,
      date_from: null,
      date_to: null,
      summary: {
        total_test_cases: 12,
        total_test_suites: 4,
        total_test_runs: 5,
        active_runs: 1,
        overall_pass_rate: 0.6,
        total_results: 30,
        result_distribution: { passed: 18, failed: 12 }
      },
      runs: [],
      test_case_distribution: {
        by_priority: {},
        by_type: {},
        by_automation: { automated: 4, manual: 8 }
      },
      trend: [],
      per_project: [
        {
          project_id: 1,
          project_name: 'Alpha',
          is_archived: false,
          total_test_runs: 3,
          completed_runs: 2,
          overall_pass_rate: 0.7,
          total_results: 20
        },
        {
          project_id: 2,
          project_name: 'Beta',
          is_archived: false,
          total_test_runs: 2,
          completed_runs: 1,
          overall_pass_rate: 0.5,
          total_results: 10
        }
      ],
      ...overrides
    })

    it('populates crossProjectAnalytics from API response', async () => {
      const data = makeCross()
      vi.mocked(reportsApi.getCrossProjectReportAnalytics).mockResolvedValueOnce(data)

      await store.fetchCrossProjectReportAnalytics()

      expect(store.crossProjectAnalytics).toEqual(data)
      expect(store.crossProjectAnalytics?.per_project).toHaveLength(2)
    })

    it('passes params through to the API including project_ids', async () => {
      vi.mocked(reportsApi.getCrossProjectReportAnalytics).mockResolvedValueOnce(makeCross())

      await store.fetchCrossProjectReportAnalytics({
        project_ids: [1, 2, 3],
        date_from: '2026-01-01T00:00:00Z',
        include_archived: true
      })

      expect(reportsApi.getCrossProjectReportAnalytics).toHaveBeenCalledWith({
        project_ids: [1, 2, 3],
        date_from: '2026-01-01T00:00:00Z',
        include_archived: true
      })
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(reportsApi.getCrossProjectReportAnalytics).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(store.fetchCrossProjectReportAnalytics()).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load report analytics')
      expect(store.loading).toBe(false)
    })
  })

  describe('clearCrossProjectAnalytics', () => {
    it('resets only the cross-project slot', async () => {
      // Populate both slots.
      vi.mocked(reportsApi.getProjectReportAnalytics).mockResolvedValueOnce(makeAnalytics())
      vi.mocked(reportsApi.getCrossProjectReportAnalytics).mockResolvedValueOnce({
        project_ids: null,
        date_from: null,
        date_to: null,
        summary: {
          total_test_cases: 0,
          total_test_suites: 0,
          total_test_runs: 0,
          active_runs: 0,
          overall_pass_rate: 0,
          total_results: 0,
          result_distribution: {}
        },
        runs: [],
        test_case_distribution: {
          by_priority: {},
          by_type: {},
          by_automation: { automated: 0, manual: 0 }
        },
        trend: [],
        per_project: []
      })
      await store.fetchReportAnalytics(1)
      await store.fetchCrossProjectReportAnalytics()

      store.clearCrossProjectAnalytics()

      expect(store.crossProjectAnalytics).toBeNull()
      expect(store.analytics).not.toBeNull()
    })
  })

  describe('clearProjectAnalytics', () => {
    it('resets only the per-project slot', async () => {
      vi.mocked(reportsApi.getProjectReportAnalytics).mockResolvedValueOnce(makeAnalytics())
      await store.fetchReportAnalytics(1)
      expect(store.analytics).not.toBeNull()

      store.clearProjectAnalytics()

      expect(store.analytics).toBeNull()
    })
  })
})
