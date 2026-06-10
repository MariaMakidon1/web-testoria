import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import UserForm from '@/components/users/UserForm.vue'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types/auth'

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

const SelectStub = {
  template: '<div class="select-stub" />',
  props: ['options', 'modelValue', 'optionLabel', 'optionValue', 'disabled'],
}
const PasswordStub = {
  template: '<div class="password-stub" />',
  props: ['modelValue', 'disabled'],
}
const InputTextStub = { template: '<input />', props: ['modelValue', 'disabled'] }
const ToggleStub = { template: '<input type="checkbox" />', props: ['modelValue', 'disabled'] }

const baseModel = {
  username: 'jdoe',
  email: 'jdoe@example.com',
  full_name: 'J Doe',
  password: '',
  role: 'tester' as UserRole,
  is_active: true,
}

function mountForm(role: UserRole, isEdit = false) {
  setActivePinia(createPinia())
  const auth = useAuthStore()
  auth.user = { id: 1, username: 'me', email: 'me@x.com', role }
  return mount(UserForm, {
    props: { modelValue: { ...baseModel }, isEdit },
    global: {
      stubs: {
        Select: SelectStub,
        Password: PasswordStub,
        InputText: InputTextStub,
        ToggleSwitch: ToggleStub,
      },
    },
  })
}

describe('UserForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('role options (Lead capped at Lead)', () => {
    it('offers the Admin role to an admin', () => {
      const wrapper = mountForm('admin')
      const values = wrapper
        .findComponent(SelectStub)
        .props('options')
        .map((o: { value: string }) => o.value)
      expect(values).toContain('admin')
    })

    it('hides the Admin role from a lead', () => {
      const wrapper = mountForm('lead')
      const values = wrapper
        .findComponent(SelectStub)
        .props('options')
        .map((o: { value: string }) => o.value)
      expect(values).not.toContain('admin')
      expect(values).toContain('lead')
      expect(values).toContain('tester')
    })
  })

  describe('invite-only creation', () => {
    it('shows no password field when creating', () => {
      const wrapper = mountForm('admin', false)
      expect(wrapper.findComponent(PasswordStub).exists()).toBe(false)
    })

    it('shows the password field when editing', () => {
      const wrapper = mountForm('admin', true)
      expect(wrapper.findComponent(PasswordStub).exists()).toBe(true)
    })
  })
})
