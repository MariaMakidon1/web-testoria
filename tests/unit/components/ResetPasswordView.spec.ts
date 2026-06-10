import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ResetPasswordView from '@/views/auth/ResetPasswordView.vue'

// Mocked auth API — the store calls these under the hood.
vi.mock('@/api/auth', () => ({
  validateResetToken: vi.fn(),
  resetPassword: vi.fn(),
  forgotPassword: vi.fn(),
}))
import * as authApi from '@/api/auth'

// vue-router stubs: each test sets the current route via `currentRoute`.
const push = vi.fn()
let currentRoute: { name: string; query: Record<string, string> }
vi.mock('vue-router', () => ({
  useRoute: () => currentRoute,
  useRouter: () => ({ push }),
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

describe('ResetPasswordView', () => {
  beforeEach(() => {
    push.mockClear()
    currentRoute = { name: 'ResetPassword', query: {} }
  })

  it('shows the invalid state when no token is present, without calling the API', async () => {
    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    expect(wrapper.find('[data-testid="reset-invalid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-form"]').exists()).toBe(false)
    expect(authApi.validateResetToken).not.toHaveBeenCalled()
  })

  it('shows the invalid state when the token fails validation', async () => {
    currentRoute = { name: 'ResetPassword', query: { token: 'bad' } }
    vi.mocked(authApi.validateResetToken).mockRejectedValueOnce({
      response: { data: { detail: 'expired' } },
    })

    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    expect(authApi.validateResetToken).toHaveBeenCalledWith('bad')
    expect(wrapper.find('[data-testid="reset-invalid"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-form"]').exists()).toBe(false)
  })

  it('shows the set-password form when the token is valid', async () => {
    currentRoute = { name: 'ResetPassword', query: { token: 'good' } }
    vi.mocked(authApi.validateResetToken).mockResolvedValueOnce({
      valid: true,
      username: 'jdoe',
    })

    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    expect(wrapper.find('[data-testid="reset-form"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="reset-invalid"]').exists()).toBe(false)
  })

  it('uses the welcome heading on the set-password route', async () => {
    currentRoute = { name: 'SetPassword', query: { token: 'good' } }
    vi.mocked(authApi.validateResetToken).mockResolvedValueOnce({
      valid: true,
      username: 'jdoe',
    })

    const wrapper = mount(ResetPasswordView)
    await flushPromises()

    expect(wrapper.text()).toContain('Set your password')
  })
})
