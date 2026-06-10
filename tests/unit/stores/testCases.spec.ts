import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTestCasesStore } from '@/stores/testCases'

vi.mock('@/api/testCases', () => ({
  getTestCases: vi.fn(),
  getTestCase: vi.fn(),
  createTestCase: vi.fn(),
  updateTestCase: vi.fn(),
  deleteTestCase: vi.fn(),
  importTestCases: vi.fn(),
  exportTestCases: vi.fn()
}))

import * as testCasesApi from '@/api/testCases'

const makeCase = (id: number, title = `Test Case ${id}`) => ({
  id,
  suite_id: 1,
  title,
  description: null,
  preconditions: null,
  steps: [],
  priority: 'medium' as const,
  type: 'manual' as const,
  status: 'active' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
})

const paginatedResponse = (items: ReturnType<typeof makeCase>[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 50,
  total_pages: 1
})

describe('TestCases Store', () => {
  let store: ReturnType<typeof useTestCasesStore>

  beforeEach(() => {
    store = useTestCasesStore()
  })

  describe('initial state', () => {
    it('starts with empty test cases', () => {
      expect(store.testCases).toEqual([])
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })

    it('starts with empty filters', () => {
      expect(store.filters).toEqual({})
    })
  })

  describe('fetchTestCases', () => {
    it('populates testCases from API response', async () => {
      const cases = [makeCase(1), makeCase(2)]
      vi.mocked(testCasesApi.getTestCases).mockResolvedValueOnce(paginatedResponse(cases))

      await store.fetchTestCases(10)

      expect(store.testCases).toHaveLength(2)
      expect(store.testCases[0].id).toBe(1)
    })

    it('merges new filters into store filters', async () => {
      vi.mocked(testCasesApi.getTestCases).mockResolvedValueOnce(paginatedResponse([]))

      await store.fetchTestCases(10, { priority: 'High' })

      expect(store.filters.priority).toBe('High')
    })

    it('sets loading=false when complete', async () => {
      vi.mocked(testCasesApi.getTestCases).mockResolvedValueOnce(paginatedResponse([]))

      await store.fetchTestCases(10)

      expect(store.loading).toBe(false)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(testCasesApi.getTestCases).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchTestCases(10)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load test cases')
    })
  })

  describe('createTestCase', () => {
    it('returns the created test case and prepends it to the list', async () => {
      const created = makeCase(42)
      vi.mocked(testCasesApi.createTestCase).mockResolvedValueOnce(created)

      const result = await store.createTestCase(10, {
        suite_id: 1,
        title: 'New Case',
        priority: 'high',
        type: 'manual'
      })

      expect(result.id).toBe(42)
      expect(store.testCases[0].id).toBe(42)
    })

    it('propagates error when API fails', async () => {
      vi.mocked(testCasesApi.createTestCase).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.createTestCase(10, {
        suite_id: 1,
        title: 'Local Case',
        priority: 'medium',
        type: 'manual'
      })).rejects.toThrow('Network error')
    })
  })

  describe('updateTestCase', () => {
    it('updates case in the list', async () => {
      const original = makeCase(1)
      store.testCases = [original]
      const updated = { ...original, title: 'Updated Title' }
      vi.mocked(testCasesApi.updateTestCase).mockResolvedValueOnce(updated)

      await store.updateTestCase(1, { title: 'Updated Title' })

      expect(store.testCases[0].title).toBe('Updated Title')
    })

    it('updates currentTestCase when it matches', async () => {
      const original = makeCase(1)
      store.currentTestCase = original
      const updated = { ...original, title: 'Updated' }
      vi.mocked(testCasesApi.updateTestCase).mockResolvedValueOnce(updated)

      await store.updateTestCase(1, { title: 'Updated' })

      expect(store.currentTestCase?.title).toBe('Updated')
    })
  })

  describe('deleteTestCase', () => {
    it('removes case from testCases list', async () => {
      store.testCases = [makeCase(1), makeCase(2)]
      vi.mocked(testCasesApi.deleteTestCase).mockResolvedValueOnce(undefined)

      await store.deleteTestCase(1)

      expect(store.testCases).toHaveLength(1)
      expect(store.testCases[0].id).toBe(2)
    })

    it('clears currentTestCase when deleted case matches', async () => {
      store.testCases = [makeCase(1)]
      store.currentTestCase = makeCase(1)
      vi.mocked(testCasesApi.deleteTestCase).mockResolvedValueOnce(undefined)

      await store.deleteTestCase(1)

      expect(store.currentTestCase).toBeNull()
    })
  })

  describe('clearFilters', () => {
    it('resets filters and page to 1', () => {
      store.filters = { priority: 'High' }
      store.pagination.page = 3

      store.clearFilters()

      expect(store.filters).toEqual({})
      expect(store.pagination.page).toBe(1)
    })
  })

  describe('getProjectCases', () => {
    it('returns cases for a specific project', () => {
      store.allCases[5] = [makeCase(1), makeCase(2)]

      expect(store.getProjectCases(5)).toHaveLength(2)
    })

    it('returns empty array for unknown project', () => {
      expect(store.getProjectCases(999)).toEqual([])
    })
  })

  describe('allCasesFlat', () => {
    it('returns all cases across all projects', () => {
      store.allCases[1] = [makeCase(1)]
      store.allCases[2] = [makeCase(2), makeCase(3)]

      expect(store.allCasesFlat).toHaveLength(3)
    })
  })
})
