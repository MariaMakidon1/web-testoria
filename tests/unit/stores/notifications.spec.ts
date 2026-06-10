import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useNotificationsStore } from '@/stores/notifications'

describe('Notifications Store', () => {
  let store: ReturnType<typeof useNotificationsStore>

  beforeEach(() => {
    vi.useFakeTimers()
    store = useNotificationsStore()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should start with empty notifications', () => {
      expect(store.notifications).toEqual([])
    })

    it('should have default max notifications', () => {
      expect(store.maxNotifications).toBe(5)
    })
  })

  describe('add', () => {
    it('should add a notification', () => {
      store.add({ title: 'Test', message: 'Test message' })
      expect(store.notifications).toHaveLength(1)
      expect(store.notifications[0].title).toBe('Test')
    })

    it('should generate unique id', () => {
      store.add({ title: 'Test 1' })
      store.add({ title: 'Test 2' })
      expect(store.notifications[0].id).not.toBe(store.notifications[1].id)
    })

    it('should set default type to info', () => {
      store.add({ title: 'Test' })
      expect(store.notifications[0].type).toBe('info')
    })

    it('should set specified type', () => {
      store.add({ title: 'Test', type: 'error' })
      expect(store.notifications[0].type).toBe('error')
    })

    it('should auto-remove after duration', () => {
      store.add({ title: 'Test', duration: 5000 })
      expect(store.notifications).toHaveLength(1)

      vi.advanceTimersByTime(5000)
      expect(store.notifications).toHaveLength(0)
    })

    it('should not auto-remove if duration is 0', () => {
      store.add({ title: 'Test', duration: 0 })
      vi.advanceTimersByTime(10000)
      expect(store.notifications).toHaveLength(1)
    })

    it('should add to beginning of list', () => {
      store.add({ title: 'First' })
      store.add({ title: 'Second' })
      expect(store.notifications[0].title).toBe('Second')
    })
  })

  describe('remove', () => {
    it('should remove notification by id', () => {
      const id = store.add({ title: 'Test' })
      expect(store.notifications).toHaveLength(1)

      store.remove(id)
      expect(store.notifications).toHaveLength(0)
    })

    it('should not fail for non-existent id', () => {
      store.add({ title: 'Test' })
      store.remove('non-existent')
      expect(store.notifications).toHaveLength(1)
    })
  })

  describe('clear', () => {
    it('should remove all notifications', () => {
      store.add({ title: 'Test 1' })
      store.add({ title: 'Test 2' })
      store.add({ title: 'Test 3' })

      store.clear()
      expect(store.notifications).toHaveLength(0)
    })
  })

  describe('convenience methods', () => {
    it('success should create success notification', () => {
      store.success('Success!', 'Operation completed')
      expect(store.notifications[0].type).toBe('success')
      expect(store.notifications[0].title).toBe('Success!')
      expect(store.notifications[0].message).toBe('Operation completed')
    })

    it('info should create info notification', () => {
      store.info('Info')
      expect(store.notifications[0].type).toBe('info')
    })

    it('warning should create warning notification', () => {
      store.warning('Warning')
      expect(store.notifications[0].type).toBe('warning')
    })

    it('error should create error notification', () => {
      store.error('Error')
      expect(store.notifications[0].type).toBe('error')
    })

    it('error should have longer duration', () => {
      store.error('Error')
      expect(store.notifications[0].duration).toBe(8000)
    })
  })

  describe('activeNotifications', () => {
    it('should return limited notifications', () => {
      for (let i = 0; i < 10; i++) {
        store.add({ title: `Test ${i}`, duration: 0 })
      }

      expect(store.activeNotifications).toHaveLength(5)
    })
  })
})
