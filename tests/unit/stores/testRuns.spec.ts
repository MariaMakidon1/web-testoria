import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTestRunsStore } from '@/stores/testRuns'

vi.mock('@/api/testRuns', () => ({
  getTestRuns: vi.fn(),
  getTestRun: vi.fn(),
  createTestRun: vi.fn(),
  updateTestRun: vi.fn(),
  deleteTestRun: vi.fn(),
  closeTestRun: vi.fn(),
  setRunCases: vi.fn(),
  getTestRunWithCases: vi.fn()
}))

import * as testRunsApi from '@/api/testRuns'

const makeRun = (id: number, name = `Run ${id}`) => ({
  id,
  project_id: 10,
  suite_id: null,
  milestone_id: null,
  name,
  config: null,
  assigned_to: null,
  status: 'active' as const,
  created_at: '2024-01-01T00:00:00Z',
  completed_at: null,
  progress: { total: 5, passed: 0, failed: 0, blocked: 0, no_run: 5, pass_rate: 0 }
})

const paginatedResponse = (items: ReturnType<typeof makeRun>[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 20,
  total_pages: 1
})

describe('TestRuns Store', () => {
  let store: ReturnType<typeof useTestRunsStore>

  beforeEach(() => {
    store = useTestRunsStore()
  })

  describe('initial state', () => {
    it('starts with empty runs', () => {
      expect(store.testRuns).toEqual([])
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })

    it('starts with empty filters', () => {
      expect(store.filters).toEqual({})
    })
  })

  describe('fetchTestRuns', () => {
    it('populates testRuns from API response', async () => {
      const runs = [makeRun(1), makeRun(2)]
      vi.mocked(testRunsApi.getTestRuns).mockResolvedValueOnce(paginatedResponse(runs))

      await store.fetchTestRuns(10)

      expect(store.testRuns).toHaveLength(2)
      expect(store.testRuns[0].id).toBe(1)
    })

    it('sets loading=false when done', async () => {
      vi.mocked(testRunsApi.getTestRuns).mockResolvedValueOnce(paginatedResponse([]))

      await store.fetchTestRuns(10)

      expect(store.loading).toBe(false)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(testRunsApi.getTestRuns).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchTestRuns(10)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load test runs')
    })
  })

  describe('createTestRun', () => {
    it('returns the created run and prepends to list', async () => {
      const created = makeRun(42)
      vi.mocked(testRunsApi.createTestRun).mockResolvedValueOnce(created)

      const result = await store.createTestRun(10, { name: 'New Run' })

      expect(result.id).toBe(42)
      expect(store.testRuns[0].id).toBe(42)
    })

    it('propagates error when API fails', async () => {
      vi.mocked(testRunsApi.createTestRun).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.createTestRun(10, { name: 'Local Run' })).rejects.toThrow('Network error')
    })
  })

  describe('updateTestRun', () => {
    it('updates run in the list', async () => {
      const original = makeRun(1)
      store.testRuns = [original]
      const updated = { ...original, name: 'Updated Run' }
      vi.mocked(testRunsApi.updateTestRun).mockResolvedValueOnce(updated)

      await store.updateTestRun(1, { name: 'Updated Run' })

      expect(store.testRuns[0].name).toBe('Updated Run')
    })

    it('updates currentTestRun when it matches', async () => {
      const original = makeRun(1)
      store.currentTestRun = original
      const updated = { ...original, name: 'Updated' }
      vi.mocked(testRunsApi.updateTestRun).mockResolvedValueOnce(updated)

      await store.updateTestRun(1, { name: 'Updated' })

      expect(store.currentTestRun?.name).toBe('Updated')
    })
  })

  describe('deleteTestRun', () => {
    it('removes run from testRuns list', async () => {
      store.testRuns = [makeRun(1), makeRun(2)]
      vi.mocked(testRunsApi.deleteTestRun).mockResolvedValueOnce(undefined)

      await store.deleteTestRun(1)

      expect(store.testRuns).toHaveLength(1)
      expect(store.testRuns[0].id).toBe(2)
    })

    it('clears currentTestRun when deleted run matches', async () => {
      store.testRuns = [makeRun(1)]
      store.currentTestRun = makeRun(1)
      vi.mocked(testRunsApi.deleteTestRun).mockResolvedValueOnce(undefined)

      await store.deleteTestRun(1)

      expect(store.currentTestRun).toBeNull()
    })
  })

  describe('setRunCases', () => {
    it('calls API and merges response into currentTestRun', async () => {
      const run = makeRun(1)
      store.currentTestRun = run
      const updated = { ...run, cases_mode: 'explicit' as const }
      vi.mocked(testRunsApi.setRunCases).mockResolvedValueOnce(updated)

      await store.setRunCases(1, [10, 20, 30])

      expect(testRunsApi.setRunCases).toHaveBeenCalledWith(1, [10, 20, 30])
      expect(store.currentTestRun?.cases_mode).toBe('explicit')
    })

    it('updates the run in the testRuns list', async () => {
      const run = makeRun(5)
      store.testRuns = [run]
      const updated = { ...run, cases_mode: 'explicit' as const }
      vi.mocked(testRunsApi.setRunCases).mockResolvedValueOnce(updated)

      await store.setRunCases(5, [])

      expect(store.testRuns[0].cases_mode).toBe('explicit')
    })
  })

  describe('closeTestRun', () => {
    it('sets status to completed', async () => {
      const run = makeRun(1)
      store.testRuns = [run]
      const closed = { ...run, status: 'completed' as const, completed_at: '2024-06-01T00:00:00Z' }
      vi.mocked(testRunsApi.closeTestRun).mockResolvedValueOnce(closed)

      await store.closeTestRun(1)

      expect(store.testRuns[0].status).toBe('completed')
    })
  })

  describe('updateTestRunProgress', () => {
    it('updates progress on the matching run', () => {
      store.testRuns = [makeRun(1)]
      const newProgress = { total: 5, passed: 3, failed: 1, blocked: 0, no_run: 1, pass_rate: 60 }

      store.updateTestRunProgress(1, newProgress)

      expect(store.testRuns[0].progress.passed).toBe(3)
      expect(store.testRuns[0].progress.pass_rate).toBe(60)
    })

    it('updates currentTestRun progress when it matches', () => {
      store.currentTestRun = makeRun(1)
      const newProgress = { total: 5, passed: 5, failed: 0, blocked: 0, no_run: 0, pass_rate: 100 }

      store.updateTestRunProgress(1, newProgress)

      expect(store.currentTestRun?.progress.pass_rate).toBe(100)
    })
  })

  describe('clearFilters', () => {
    it('resets filters and page to 1', () => {
      store.filters = { status: 'active' }
      store.pagination.page = 3

      store.clearFilters()

      expect(store.filters).toEqual({})
      expect(store.pagination.page).toBe(1)
    })
  })

  describe('allRunsFlat', () => {
    it('returns all runs across all projects', () => {
      store.allRuns[1] = [makeRun(1)]
      store.allRuns[2] = [makeRun(2), makeRun(3)]

      expect(store.allRunsFlat).toHaveLength(3)
    })
  })

  describe('progress initialization', () => {
    it('new run starts with every case counted as no_run', async () => {
      const created = makeRun(42)
      vi.mocked(testRunsApi.createTestRun).mockResolvedValueOnce(created)
      const run = await store.createTestRun(10, { name: 'Fresh Run' })
      expect(run.progress.passed).toBe(0)
      expect(run.progress.failed).toBe(0)
      expect(run.progress.no_run).toBe(5)
      expect(run.progress.total).toBe(5)
    })
  })

  describe('status transitions', () => {
    it('updateTestRunProgress reflects all breakdown fields', () => {
      store.testRuns = [makeRun(1)]
      const newProgress = {
        total: 10, passed: 5, failed: 2, blocked: 1, no_run: 2, pass_rate: 50
      }
      store.updateTestRunProgress(1, newProgress)
      const p = store.testRuns[0].progress
      expect(p.total).toBe(10)
      expect(p.passed).toBe(5)
      expect(p.failed).toBe(2)
      expect(p.blocked).toBe(1)
      expect(p.no_run).toBe(2)
      expect(p.pass_rate).toBe(50)
    })
  })
})
