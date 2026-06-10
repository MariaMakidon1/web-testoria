import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useSavedFiltersStore } from '@/stores/savedFilters'

describe('Saved Filters Store', () => {
  let store: ReturnType<typeof useSavedFiltersStore>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    store = useSavedFiltersStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should start with empty filters', () => {
      expect(store.filters).toEqual([])
    })
  })

  describe('saveFilter', () => {
    it('should add a new filter', () => {
      store.saveFilter('My Filter', 'test-cases', { status: 'Active' })

      expect(store.filters).toHaveLength(1)
      expect(store.filters[0].name).toBe('My Filter')
      expect(store.filters[0].context).toBe('test-cases')
    })

    it('should generate unique id', () => {
      store.saveFilter('Filter 1', 'test-cases', {})
      store.saveFilter('Filter 2', 'test-cases', {})

      expect(store.filters[0].id).not.toBe(store.filters[1].id)
    })

    it('should set isDefault when specified', () => {
      store.saveFilter('Default Filter', 'test-cases', {}, true)
      expect(store.filters[0].isDefault).toBe(true)
    })

    it('should clear other defaults when setting new default', () => {
      store.saveFilter('Filter 1', 'test-cases', {}, true)
      store.saveFilter('Filter 2', 'test-cases', {}, true)

      expect(store.filters[0].isDefault).toBe(false)
      expect(store.filters[1].isDefault).toBe(true)
    })

    it('should persist to localStorage', () => {
      store.saveFilter('Test', 'test-cases', {})
      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('updateFilter', () => {
    it('should update filter name', () => {
      const filter = store.saveFilter('Original', 'test-cases', {})
      store.updateFilter(filter.id, { name: 'Updated' })

      expect(store.filters[0].name).toBe('Updated')
    })

    it('should update filter values', () => {
      const filter = store.saveFilter('Test', 'test-cases', { old: 'value' })
      store.updateFilter(filter.id, { filters: { new: 'value' } })

      expect(store.filters[0].filters).toEqual({ new: 'value' })
    })

    it('should return null for non-existent filter', () => {
      const result = store.updateFilter('non-existent', { name: 'Test' })
      expect(result).toBeNull()
    })

    it('should update updatedAt timestamp', () => {
      const filter = store.saveFilter('Test', 'test-cases', {})
      const originalUpdatedAt = filter.updatedAt

      // Small delay to ensure different timestamp
      vi.advanceTimersByTime(100)
      store.updateFilter(filter.id, { name: 'Updated' })

      expect(store.filters[0].updatedAt).not.toBe(originalUpdatedAt)
    })
  })

  describe('deleteFilter', () => {
    it('should remove filter', () => {
      const filter = store.saveFilter('Test', 'test-cases', {})
      store.deleteFilter(filter.id)

      expect(store.filters).toHaveLength(0)
    })

    it('should return false for non-existent filter', () => {
      const result = store.deleteFilter('non-existent')
      expect(result).toBe(false)
    })

    it('should return true on success', () => {
      const filter = store.saveFilter('Test', 'test-cases', {})
      const result = store.deleteFilter(filter.id)
      expect(result).toBe(true)
    })
  })

  describe('setAsDefault', () => {
    it('should set filter as default', () => {
      const filter = store.saveFilter('Test', 'test-cases', {})
      store.setAsDefault(filter.id)

      expect(store.filters[0].isDefault).toBe(true)
    })

    it('should clear other defaults in same context', () => {
      const filter1 = store.saveFilter('Filter 1', 'test-cases', {}, true)
      const filter2 = store.saveFilter('Filter 2', 'test-cases', {})

      store.setAsDefault(filter2.id)

      const f1 = store.filters.find(f => f.id === filter1.id)
      const f2 = store.filters.find(f => f.id === filter2.id)

      expect(f1?.isDefault).toBe(false)
      expect(f2?.isDefault).toBe(true)
    })

    it('should not affect filters in different context', () => {
      store.saveFilter('TC Filter', 'test-cases', {}, true)
      const trFilter = store.saveFilter('TR Filter', 'test-runs', {})

      store.setAsDefault(trFilter.id)

      expect(store.filters[0].isDefault).toBe(true) // test-cases still default
      expect(store.filters[1].isDefault).toBe(true) // test-runs now default
    })
  })

  describe('getFiltersByContext', () => {
    it('should return filters for specific context', () => {
      store.saveFilter('TC 1', 'test-cases', {})
      store.saveFilter('TC 2', 'test-cases', {})
      store.saveFilter('TR 1', 'test-runs', {})

      const tcFilters = store.getFiltersByContext('test-cases')
      expect(tcFilters).toHaveLength(2)
    })

    it('should return empty array for unknown context', () => {
      store.saveFilter('Test', 'test-cases', {})
      const filters = store.getFiltersByContext('unknown')
      expect(filters).toHaveLength(0)
    })
  })

  describe('getDefaultFilter', () => {
    it('should return default filter for context', () => {
      store.saveFilter('Not Default', 'test-cases', {})
      store.saveFilter('Default', 'test-cases', {}, true)

      const defaultFilter = store.getDefaultFilter('test-cases')
      expect(defaultFilter?.name).toBe('Default')
    })

    it('should return undefined if no default', () => {
      store.saveFilter('Test', 'test-cases', {})
      const defaultFilter = store.getDefaultFilter('test-cases')
      expect(defaultFilter).toBeUndefined()
    })
  })
})
