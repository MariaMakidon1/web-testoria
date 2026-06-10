import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TestResultDetail from '@/components/test-runs/TestResultDetail.vue'
import { useAuthStore } from '@/stores/auth'
import type { TestResult } from '@/types/testResult'
import type { User, UserRole } from '@/types/auth'

vi.mock('@/api/testResults', () => ({
  getTestResults: vi.fn(),
  updateTestResult: vi.fn(),
  uploadAttachmentsBulk: vi.fn(),
  getResultHistory: vi.fn(),
  addDefect: vi.fn(),
  removeDefect: vi.fn(),
  fetchRunCasesWithResults: vi.fn(),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

const stubs = {
  TabView: { template: '<div><slot /></div>' },
  TabPanel: { template: '<div><slot /></div>' },
  TestResultHistoryPanel: { template: '<div />' },
  DefectsPanel: { template: '<div />' },
  Dialog: { template: '<div><slot /></div>' },
  Textarea: { template: '<textarea />' },
  Badge: { template: '<span><slot /></span>' },
}

const makeUser = (role: UserRole): User => ({
  id: 1,
  username: 'u',
  email: 'u@example.com',
  full_name: null,
  role,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
})

const makeResult = (overrides: Partial<TestResult> = {}): TestResult => ({
  id: 42,
  test_run_id: 7,
  test_case_id: 99,
  status: 'passed',
  comment: null,
  message: null,
  stack_trace: null,
  execution_time: null,
  defects: null,
  tested_by: null,
  tested_at: '2026-05-11T10:00:00Z',
  test_case: { id: 99, title: 'Sample case', type: 'functional', priority: 'medium' },
  ...overrides,
})

function mountDetail(opts: { result?: TestResult | null; role?: UserRole } = {}) {
  const role = opts.role ?? 'lead'
  const auth = useAuthStore()
  auth.user = makeUser(role)

  return mount(TestResultDetail, {
    props: {
      result: opts.result === undefined ? makeResult() : opts.result,
      history: [],
      suiteName: 'My Suite',
      isSaving: false,
    },
    global: { stubs },
  })
}

describe('TestResultDetail', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('emits edit-test-case with the result when the header Edit button is clicked', async () => {
    const result = makeResult()
    const wrapper = mountDetail({ result, role: 'lead' })
    await flushPromises()

    await wrapper
      .find('[data-testid="result-detail-edit-test-case"]')
      .trigger('click')

    expect(wrapper.emitted('edit-test-case')?.[0]).toEqual([result])
    expect(wrapper.emitted('execute-result')).toBeUndefined()
  })

  it('emits execute-result with the result when the not-yet-run Execute button is clicked', async () => {
    const result = makeResult({ id: null })
    const wrapper = mountDetail({ result, role: 'lead' })
    await flushPromises()

    await wrapper
      .find('[data-testid="result-detail-execute"]')
      .trigger('click')

    expect(wrapper.emitted('execute-result')?.[0]).toEqual([result])
    expect(wrapper.emitted('edit-test-case')).toBeUndefined()
  })

  it('hides the header Edit button for users below lead role', async () => {
    const wrapper = mountDetail({ role: 'tester' })
    await flushPromises()

    expect(
      wrapper.find('[data-testid="result-detail-edit-test-case"]').exists(),
    ).toBe(false)
  })

  it('shows the header Edit button for admin', async () => {
    const wrapper = mountDetail({ role: 'admin' })
    await flushPromises()

    expect(
      wrapper.find('[data-testid="result-detail-edit-test-case"]').exists(),
    ).toBe(true)
  })
})
