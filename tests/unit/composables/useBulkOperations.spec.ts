import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBulkOperations, type BulkOperation } from '@/composables/useBulkOperations'

interface TestItem {
  id: number
  name: string
}

describe('useBulkOperations', () => {
  const mockDelete = vi.fn().mockResolvedValue(undefined)
  const mockArchive = vi.fn().mockResolvedValue(undefined)

  const operations: BulkOperation<TestItem>[] = [
    {
      id: 'delete',
      label: 'Delete',
      icon: 'pi pi-trash',
      severity: 'danger',
      action: mockDelete,
      confirmMessage: (count) => `Delete ${count} item(s)?`
    },
    {
      id: 'archive',
      label: 'Archive',
      icon: 'pi pi-folder',
      action: mockArchive
    }
  ]

  let bulk: ReturnType<typeof useBulkOperations<TestItem>>

  beforeEach(() => {
    vi.clearAllMocks()
    bulk = useBulkOperations<TestItem>({ operations })
  })

  describe('initial state', () => {
    it('should start with empty selection', () => {
      expect(bulk.selectedItems.value).toEqual([])
      expect(bulk.selectedCount.value).toBe(0)
      expect(bulk.hasSelection.value).toBe(false)
    })

    it('should not be processing', () => {
      expect(bulk.processing.value).toBe(false)
    })
  })

  describe('selectItem', () => {
    it('should add item to selection', () => {
      bulk.selectItem({ id: 1, name: 'Test' })
      expect(bulk.selectedItems.value).toHaveLength(1)
    })

    it('should not add duplicate items', () => {
      const item = { id: 1, name: 'Test' }
      bulk.selectItem(item)
      bulk.selectItem(item)
      expect(bulk.selectedItems.value).toHaveLength(1)
    })
  })

  describe('deselectItem', () => {
    it('should remove item from selection', () => {
      const item = { id: 1, name: 'Test' }
      bulk.selectItem(item)
      bulk.deselectItem(item)
      expect(bulk.selectedItems.value).toHaveLength(0)
    })

    it('should handle non-existent item gracefully', () => {
      bulk.deselectItem({ id: 999, name: 'Non-existent' })
      expect(bulk.selectedItems.value).toHaveLength(0)
    })
  })

  describe('toggleItem', () => {
    it('should add item if not selected', () => {
      const item = { id: 1, name: 'Test' }
      bulk.toggleItem(item)
      expect(bulk.isSelected(item)).toBe(true)
    })

    it('should remove item if selected', () => {
      const item = { id: 1, name: 'Test' }
      bulk.selectItem(item)
      bulk.toggleItem(item)
      expect(bulk.isSelected(item)).toBe(false)
    })
  })

  describe('selectAll', () => {
    it('should select all provided items', () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' }
      ]
      bulk.selectAll(items)
      expect(bulk.selectedCount.value).toBe(3)
    })

    it('should replace existing selection', () => {
      bulk.selectItem({ id: 1, name: 'Item 1' })
      bulk.selectAll([{ id: 2, name: 'Item 2' }])
      expect(bulk.selectedCount.value).toBe(1)
      expect(bulk.selectedItems.value[0].id).toBe(2)
    })
  })

  describe('deselectAll', () => {
    it('should clear selection', () => {
      bulk.selectAll([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ])
      bulk.deselectAll()
      expect(bulk.selectedCount.value).toBe(0)
    })
  })

  describe('isSelected', () => {
    it('should return true for selected item', () => {
      const item = { id: 1, name: 'Test' }
      bulk.selectItem(item)
      expect(bulk.isSelected(item)).toBe(true)
    })

    it('should return false for non-selected item', () => {
      expect(bulk.isSelected({ id: 1, name: 'Test' })).toBe(false)
    })
  })

  describe('selectedIds', () => {
    it('should return array of selected ids', () => {
      bulk.selectAll([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ])
      expect(bulk.selectedIds.value).toEqual([1, 2])
    })
  })

  describe('executeOperation', () => {
    it('should execute operation on selected items', async () => {
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ]
      bulk.selectAll(items)

      await bulk.executeOperation('delete')

      expect(mockDelete).toHaveBeenCalled()
      expect(mockDelete.mock.calls[0][0]).toHaveLength(2)
    })

    it('should clear selection after success', async () => {
      bulk.selectItem({ id: 1, name: 'Test' })
      await bulk.executeOperation('archive')
      expect(bulk.selectedCount.value).toBe(0)
    })

    it('should return false if no selection', async () => {
      const result = await bulk.executeOperation('delete')
      expect(result).toBe(false)
    })

    it('should return false for unknown operation', async () => {
      bulk.selectItem({ id: 1, name: 'Test' })
      const result = await bulk.executeOperation('unknown')
      expect(result).toBe(false)
    })

    it('should set processing state during execution', async () => {
      bulk.selectItem({ id: 1, name: 'Test' })

      let processingDuringExecution = false
      mockArchive.mockImplementation(() => {
        processingDuringExecution = bulk.processing.value
        return Promise.resolve()
      })

      await bulk.executeOperation('archive')

      expect(processingDuringExecution).toBe(true)
      expect(bulk.processing.value).toBe(false)
    })

    it('should call onSuccess callback', async () => {
      const onSuccess = vi.fn()
      const bulkWithCallbacks = useBulkOperations<TestItem>({
        operations,
        onSuccess
      })

      bulkWithCallbacks.selectItem({ id: 1, name: 'Test' })
      await bulkWithCallbacks.executeOperation('archive')

      expect(onSuccess).toHaveBeenCalledWith('archive', 1)
    })

    it('should call onError callback on failure', async () => {
      const onError = vi.fn()
      const error = new Error('Test error')
      mockDelete.mockRejectedValueOnce(error)

      const bulkWithCallbacks = useBulkOperations<TestItem>({
        operations,
        onError
      })

      bulkWithCallbacks.selectItem({ id: 1, name: 'Test' })
      await bulkWithCallbacks.executeOperation('delete')

      expect(onError).toHaveBeenCalledWith('delete', error)
    })
  })

  describe('getConfirmMessage', () => {
    it('should return function-based message with count', () => {
      bulk.selectAll([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ])

      const message = bulk.getConfirmMessage('delete')
      expect(message).toBe('Delete 2 item(s)?')
    })

    it('should return default message if not specified', () => {
      bulk.selectItem({ id: 1, name: 'Test' })
      const message = bulk.getConfirmMessage('archive')
      expect(message).toContain('1 item')
    })
  })
})
