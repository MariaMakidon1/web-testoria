import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePreferencesStore } from '@/stores/preferences'

describe('Preferences Store', () => {
  let store: ReturnType<typeof usePreferencesStore>

  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    store = usePreferencesStore()
  })

  describe('initial state', () => {
    it('should have default theme', () => {
      expect(store.preferences.theme).toBe('light')
    })

    it('should have default page size', () => {
      expect(store.preferences.defaultPageSize).toBe(10)
    })

    it('should have autoAdvance enabled', () => {
      expect(store.preferences.autoAdvance).toBe(true)
    })

    it('should have notifications enabled', () => {
      expect(store.preferences.enableNotifications).toBe(true)
    })
  })

  describe('setPreference', () => {
    it('should update a single preference', () => {
      store.setPreference('theme', 'dark')
      expect(store.preferences.theme).toBe('dark')
    })

    it('should update the preference value correctly', () => {
      store.setPreference('compactMode', true)
      expect(store.preferences.compactMode).toBe(true)
    })
  })

  describe('setPreferences', () => {
    it('should update multiple preferences', () => {
      store.setPreferences({
        theme: 'light',
        compactMode: true,
        defaultPageSize: 25
      })

      expect(store.preferences.theme).toBe('light')
      expect(store.preferences.compactMode).toBe(true)
      expect(store.preferences.defaultPageSize).toBe(25)
    })

    it('should not affect unspecified preferences', () => {
      const originalAutoAdvance = store.preferences.autoAdvance
      store.setPreferences({ theme: 'dark' })
      expect(store.preferences.autoAdvance).toBe(originalAutoAdvance)
    })
  })

  describe('resetPreferences', () => {
    it('should reset all preferences to defaults', () => {
      store.setPreferences({
        theme: 'dark',
        compactMode: true,
        defaultPageSize: 50
      })

      store.resetPreferences()

      expect(store.preferences.theme).toBe('light')
      expect(store.preferences.compactMode).toBe(false)
      expect(store.preferences.defaultPageSize).toBe(10)
    })
  })

  describe('resetPreference', () => {
    it('should reset a single preference to default', () => {
      store.setPreference('theme', 'dark')
      store.resetPreference('theme')
      expect(store.preferences.theme).toBe('light')
    })

    it('should not affect other preferences', () => {
      store.setPreferences({ theme: 'dark', compactMode: true })
      store.resetPreference('theme')

      expect(store.preferences.theme).toBe('light')
      expect(store.preferences.compactMode).toBe(true)
    })
  })

  describe('loadPreferences', () => {
    it('should load from localStorage', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify({ theme: 'dark', defaultPageSize: 50 })
      )

      store.loadPreferences()

      expect(store.preferences.theme).toBe('dark')
      expect(store.preferences.defaultPageSize).toBe(50)
    })

    it('should handle invalid JSON gracefully', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('invalid json')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      store.loadPreferences()

      expect(store.preferences.theme).toBe('light')
      consoleSpy.mockRestore()
    })

    it('should merge with defaults for partial data', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(
        JSON.stringify({ theme: 'dark' })
      )

      store.loadPreferences()

      expect(store.preferences.theme).toBe('dark')
      expect(store.preferences.defaultPageSize).toBe(10) // default
    })
  })
})
