import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTestSuitesStore } from '@/stores/testSuites'

const mockUIStore = vi.hoisted(() => ({ clearSuiteExpandState: vi.fn() }))

vi.mock('@/api/testSuites', () => ({
  getTestSuites: vi.fn(),
  getTestSuite: vi.fn(),
  createTestSuite: vi.fn(),
  updateTestSuite: vi.fn(),
  deleteTestSuite: vi.fn()
}))

vi.mock('@/stores/ui', () => ({
  useUIStore: vi.fn(() => mockUIStore)
}))

import * as testSuitesApi from '@/api/testSuites'

const makeSuite = (id: number, parentId: number | null = null, name?: string) => ({
  id,
  project_id: 1,
  parent_suite_id: parentId,
  name: name ?? `Suite ${id}`,
  description: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
})

describe('TestSuites Store', () => {
  let store: ReturnType<typeof useTestSuitesStore>

  beforeEach(() => {
    store = useTestSuitesStore()
    store.testSuites = []
  })

  describe('initial state', () => {
    it('starts with empty test suites', () => {
      expect(store.testSuites).toEqual([])
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })
  })

  describe('suiteTree computed (flat→tree build)', () => {
    it('builds a tree from flat list with root nodes', () => {
      store.testSuites = [makeSuite(1), makeSuite(2)]
      expect(store.suiteTree).toHaveLength(2)
      expect(store.suiteTree[0].id).toBe(1)
      expect(store.suiteTree[0].level).toBe(0)
    })

    it('nests child suites under their parent', () => {
      store.testSuites = [makeSuite(1), makeSuite(2, 1), makeSuite(3, 1)]
      const tree = store.suiteTree
      expect(tree).toHaveLength(1)
      expect(tree[0].children).toHaveLength(2)
      expect(tree[0].children[0].id).toBe(2)
      expect(tree[0].children[0].level).toBe(1)
    })

    it('handles deeply nested suites', () => {
      store.testSuites = [makeSuite(1), makeSuite(2, 1), makeSuite(3, 2)]
      const tree = store.suiteTree
      expect(tree[0].children[0].children[0].id).toBe(3)
      expect(tree[0].children[0].children[0].level).toBe(2)
    })

    it('sorts siblings by name', () => {
      store.testSuites = [makeSuite(2, null, 'C Suite'), makeSuite(1, null, 'A Suite'), makeSuite(3, null, 'B Suite')]
      const tree = store.suiteTree
      expect(tree.map(n => n.id)).toEqual([1, 3, 2])
    })

    it('returns empty array when no suites', () => {
      store.testSuites = []
      expect(store.suiteTree).toEqual([])
    })

    it('does not rebuild when unrelated reactive data changes', () => {
      store.testSuites = [makeSuite(1)]
      const firstRef = store.suiteTree
      // Accessing again without mutation should return same reference (Vue caches computed)
      const secondRef = store.suiteTree
      expect(firstRef).toBe(secondRef)
    })
  })

  describe('fetchTestSuites', () => {
    it('populates testSuites from API response', async () => {
      vi.mocked(testSuitesApi.getTestSuites).mockResolvedValueOnce([makeSuite(1), makeSuite(2)])
      await store.fetchTestSuites(1)
      expect(store.testSuites).toHaveLength(2)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(testSuitesApi.getTestSuites).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchTestSuites(1)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load test suites')
    })
  })

  describe('createTestSuite', () => {
    it('adds the created suite to the list', async () => {
      const suite = makeSuite(42)
      vi.mocked(testSuitesApi.createTestSuite).mockResolvedValueOnce(suite)
      await store.createTestSuite(1, { name: 'New Suite' })
      expect(store.testSuites.some(s => s.id === 42)).toBe(true)
    })

    it('propagates error when API fails', async () => {
      vi.mocked(testSuitesApi.createTestSuite).mockRejectedValueOnce(new Error('fail'))

      await expect(store.createTestSuite(1, { name: 'Local Suite' })).rejects.toThrow('fail')
    })
  })

  describe('deleteTestSuite', () => {
    it('removes suite from the list', async () => {
      store.testSuites = [makeSuite(1), makeSuite(2)]
      vi.mocked(testSuitesApi.deleteTestSuite).mockResolvedValueOnce(undefined)
      await store.deleteTestSuite(1)
      expect(store.testSuites).toHaveLength(1)
      expect(store.testSuites[0].id).toBe(2)
    })

    it('clears currentSuite when deleted suite matches', async () => {
      store.testSuites = [makeSuite(1)]
      store.currentSuite = makeSuite(1)
      vi.mocked(testSuitesApi.deleteTestSuite).mockResolvedValueOnce(undefined)
      await store.deleteTestSuite(1)
      expect(store.currentSuite).toBeNull()
    })

    it('clears the UI store expand state for the deleted suite', async () => {
      store.testSuites = [makeSuite(5)]
      vi.mocked(testSuitesApi.deleteTestSuite).mockResolvedValueOnce(undefined)
      await store.deleteTestSuite(5)
      expect(mockUIStore.clearSuiteExpandState).toHaveBeenCalledWith(5)
    })
  })

  describe('getSuiteById', () => {
    it('returns the suite with the given id', () => {
      store.testSuites = [makeSuite(1), makeSuite(2)]
      expect(store.getSuiteById(2)?.id).toBe(2)
    })

    it('returns undefined for unknown id', () => {
      store.testSuites = [makeSuite(1)]
      expect(store.getSuiteById(999)).toBeUndefined()
    })
  })
})
