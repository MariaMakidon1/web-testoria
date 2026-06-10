import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth'

// Mock the auth API
vi.mock('@/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  refreshToken: vi.fn(),
  getRoles: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  validateResetToken: vi.fn(),
}))

import * as authApi from '@/api/auth'

const mockUser = { id: 1, username: 'admin', email: 'admin@test.com', role: 'admin' as const }
const mockTokens = { access_token: 'access-abc', refresh_token: 'refresh-xyz' }

describe('Auth Store', () => {
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    vi.mocked(localStorage.getItem).mockReturnValue(null)
    authStore = useAuthStore()
  })

  describe('initial state', () => {
    it('should start with no user', () => {
      expect(authStore.user).toBeNull()
    })

    it('should start with no access token', () => {
      expect(authStore.accessToken).toBeNull()
    })

    it('should start with no refresh token', () => {
      expect(authStore.refreshToken).toBeNull()
    })

    it('should not be authenticated initially', () => {
      expect(authStore.isAuthenticated).toBe(false)
    })

    it('should not be loading initially', () => {
      expect(authStore.loading).toBe(false)
    })
  })

  describe('computed flags with no user', () => {
    it('isAuthenticated returns false when no token', () => {
      expect(authStore.isAuthenticated).toBe(false)
    })

    it('isAdmin returns false when no user', () => {
      expect(authStore.isAdmin).toBe(false)
    })

    it('isProjectManager returns false when no user', () => {
      expect(authStore.isProjectManager).toBe(false)
    })

    it('canManageTests returns false when no user', () => {
      expect(authStore.canManageTests).toBe(false)
    })

    it('canManageUsers returns false when no user', () => {
      expect(authStore.canManageUsers).toBe(false)
    })
  })

  describe('login', () => {
    it('sets tokens and authenticates after successful login', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)

      await authStore.login({ username: 'admin', password: 'admin' })

      expect(authStore.isAuthenticated).toBe(true)
      expect(authStore.accessToken).toBe('access-abc')
      expect(authStore.user).toEqual(mockUser)
    })

    it('persists tokens to localStorage on login', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)

      await authStore.login({ username: 'admin', password: 'admin' })

      expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'access-abc')
      expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-xyz')
    })

    it('sets loading=false after login completes', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)

      await authStore.login({ username: 'admin', password: 'admin' })

      expect(authStore.loading).toBe(false)
    })
  })

  describe('logout', () => {
    it('clears user and tokens after logout', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)
      await authStore.login({ username: 'admin', password: 'admin' })

      vi.mocked(authApi.logout).mockResolvedValueOnce(undefined)
      await authStore.logout()

      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.user).toBeNull()
      expect(authStore.accessToken).toBeNull()
    })

    it('clears auth even when logout API call fails', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)
      await authStore.login({ username: 'admin', password: 'admin' })

      vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('Network error'))
      await authStore.logout()

      expect(authStore.isAuthenticated).toBe(false)
      expect(authStore.user).toBeNull()
    })

    it('removes tokens from localStorage on logout', async () => {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)
      await authStore.login({ username: 'admin', password: 'admin' })

      vi.mocked(authApi.logout).mockResolvedValueOnce(undefined)
      await authStore.logout()

      expect(localStorage.removeItem).toHaveBeenCalledWith('access_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token')
    })
  })

  describe('role flags', () => {
    async function loginAs(role: 'no_access' | 'read_only' | 'tester' | 'lead' | 'admin') {
      vi.mocked(authApi.login).mockResolvedValueOnce(mockTokens)
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce({ ...mockUser, role })
      await authStore.login({ username: role, password: 'pass' })
    }

    it('isAdmin is true for admin role', async () => {
      await loginAs('admin')
      expect(authStore.isAdmin).toBe(true)
    })

    it('isAdmin is false for lead role', async () => {
      await loginAs('lead')
      expect(authStore.isAdmin).toBe(false)
    })

    it('isProjectManager is true for admin role', async () => {
      await loginAs('admin')
      expect(authStore.isProjectManager).toBe(true)
    })

    it('isProjectManager is true for lead role', async () => {
      await loginAs('lead')
      expect(authStore.isProjectManager).toBe(true)
    })

    it('isProjectManager is false for tester role', async () => {
      await loginAs('tester')
      expect(authStore.isProjectManager).toBe(false)
    })

    it('canManageTests is true for tester role', async () => {
      await loginAs('tester')
      expect(authStore.canManageTests).toBe(true)
    })

    it('canManageTests is true for lead role', async () => {
      await loginAs('lead')
      expect(authStore.canManageTests).toBe(true)
    })

    it('canManageTests is false for read_only role', async () => {
      await loginAs('read_only')
      expect(authStore.canManageTests).toBe(false)
    })

    it('canManageTests is false for no_access role', async () => {
      await loginAs('no_access')
      expect(authStore.canManageTests).toBe(false)
    })

    it('canManageUsers is true for admin role', async () => {
      await loginAs('admin')
      expect(authStore.canManageUsers).toBe(true)
    })

    it('canManageUsers is true for lead role', async () => {
      await loginAs('lead')
      expect(authStore.canManageUsers).toBe(true)
    })

    it('canManageUsers is false for tester role', async () => {
      await loginAs('tester')
      expect(authStore.canManageUsers).toBe(false)
    })

    it('no permissions for no_access role', async () => {
      await loginAs('no_access')
      expect(authStore.isAdmin).toBe(false)
      expect(authStore.isProjectManager).toBe(false)
      expect(authStore.canManageTests).toBe(false)
      expect(authStore.canManageUsers).toBe(false)
    })
  })

  describe('fetchCurrentUser', () => {
    it('sets user on success', async () => {
      authStore.accessToken = 'some-token'
      vi.mocked(authApi.getCurrentUser).mockResolvedValueOnce(mockUser)

      await authStore.fetchCurrentUser()

      expect(authStore.user).toEqual(mockUser)
    })

    it('clears auth and throws on failure', async () => {
      authStore.accessToken = 'some-token'
      vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(new Error('Unauthorized'))

      await expect(authStore.fetchCurrentUser()).rejects.toThrow()
      expect(authStore.isAuthenticated).toBe(false)
    })

    it('does nothing when no access token', async () => {
      await authStore.fetchCurrentUser()
      expect(authApi.getCurrentUser).not.toHaveBeenCalled()
    })
  })

  describe('forgotPassword', () => {
    it('calls the api with the email and clears loading', async () => {
      vi.mocked(authApi.forgotPassword).mockResolvedValueOnce(undefined)

      await authStore.forgotPassword('user@test.com')

      expect(authApi.forgotPassword).toHaveBeenCalledWith({ email: 'user@test.com' })
      expect(authStore.loading).toBe(false)
      expect(authStore.error).toBeNull()
    })

    it('sets error and rethrows on failure', async () => {
      vi.mocked(authApi.forgotPassword).mockRejectedValueOnce({
        response: { data: { detail: 'SMTP down' } },
      })

      await expect(authStore.forgotPassword('user@test.com')).rejects.toBeTruthy()
      expect(authStore.error).toBe('SMTP down')
      expect(authStore.loading).toBe(false)
    })
  })

  describe('resetPassword', () => {
    it('calls the api with token and snake_case new_password', async () => {
      vi.mocked(authApi.resetPassword).mockResolvedValueOnce(undefined)

      await authStore.resetPassword('tok-123', 'NewPass123')

      expect(authApi.resetPassword).toHaveBeenCalledWith({
        token: 'tok-123',
        new_password: 'NewPass123',
      })
      expect(authStore.error).toBeNull()
    })

    it('sets error and rethrows when the token is rejected', async () => {
      vi.mocked(authApi.resetPassword).mockRejectedValueOnce({
        response: { data: { detail: 'Invalid or expired token' } },
      })

      await expect(authStore.resetPassword('bad', 'NewPass123')).rejects.toBeTruthy()
      expect(authStore.error).toBe('Invalid or expired token')
    })
  })

  describe('validateResetToken', () => {
    it('returns the validation result on success', async () => {
      vi.mocked(authApi.validateResetToken).mockResolvedValueOnce({
        valid: true,
        username: 'jdoe',
      })

      const result = await authStore.validateResetToken('tok-123')

      expect(result).toEqual({ valid: true, username: 'jdoe' })
      expect(authStore.error).toBeNull()
    })

    it('returns null and sets error when the token is invalid', async () => {
      vi.mocked(authApi.validateResetToken).mockRejectedValueOnce({
        response: { data: { detail: 'This link is no longer valid' } },
      })

      const result = await authStore.validateResetToken('bad')

      expect(result).toBeNull()
      expect(authStore.error).toBe('This link is no longer valid')
      expect(authStore.loading).toBe(false)
    })
  })
})
