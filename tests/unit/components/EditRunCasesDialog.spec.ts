import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EditRunCasesDialog from '@/components/test-runs/EditRunCasesDialog.vue'

vi.mock('@/api/testRuns', () => ({
  getTestRuns: vi.fn(),
  getTestRun: vi.fn(),
  createTestRun: vi.fn(),
  updateTestRun: vi.fn(),
  deleteTestRun: vi.fn(),
  closeTestRun: vi.fn(),
  setRunCases: vi.fn(),
  getTestRunCases: vi.fn(),
  getTestRunProgress: vi.fn()
}))

vi.mock('@/api/testSuites', () => ({
  getTestSuites: vi.fn()
}))

vi.mock('@/api/testCases', () => ({
  getTestCases: vi.fn()
}))

const toastAdd = vi.fn()
vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd })
}))

import * as testRunsApi from '@/api/testRuns'
import * as testSuitesApi from '@/api/testSuites'
import * as testCasesApi from '@/api/testCases'

function buildSuite(id: number) {
  return {
    id,
    name: `Suite ${id}`,
    project_id: 10,
    parent_suite_id: null,
    order_index: 0,
    created_at: '',
    updated_at: ''
  }
}

function buildCase(id: number, suiteId: number) {
  return {
    id,
    project_id: 10,
    suite_id: suiteId,
    title: `Case ${id}`,
    type: 'functional',
    priority: 'medium',
    status: 'active',
    steps: [],
    expected: null,
    preconditions: null,
    created_at: '',
    updated_at: ''
  }
}

function pageOf<T>(items: T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 100,
    total_pages: 1
  }
}

function mountDialog(opts: {
  runId?: number
  projectId?: number
  initialIds?: number[]
  visible?: boolean
}) {
  return mount(EditRunCasesDialog, {
    props: {
      visible: opts.visible ?? true,
      runId: opts.runId ?? 1,
      projectId: opts.projectId ?? 10,
      initialSelectedIds: opts.initialIds ?? []
    },
    global: {
      stubs: {
        Dialog: {
          template: '<div><slot /><slot name="footer" /></div>',
          props: ['visible']
        },
        TestSuiteTreeSelector: true,
        ProgressSpinner: true,
        Tag: true
      }
    }
  })
}

describe('EditRunCasesDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(testRunsApi.setRunCases).mockReset()
    vi.mocked(testRunsApi.getTestRunCases).mockReset()
    vi.mocked(testRunsApi.getTestRunProgress).mockReset()
    vi.mocked(testSuitesApi.getTestSuites).mockReset()
    vi.mocked(testCasesApi.getTestCases).mockReset()
    toastAdd.mockReset()
  })

  it('refetches suites and cases on open', async () => {
    vi.mocked(testSuitesApi.getTestSuites).mockResolvedValue([
      buildSuite(1) as never
    ])
    vi.mocked(testCasesApi.getTestCases).mockResolvedValue(
      pageOf([buildCase(42, 1), buildCase(43, 1)]) as never
    )

    const wrapper = mountDialog({ initialIds: [42, 43] })
    await flushPromises()

    expect(testSuitesApi.getTestSuites).toHaveBeenCalledWith(10)
    expect(testCasesApi.getTestCases).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ suite_id: 1 })
    )

    const selector = wrapper.findComponent({ name: 'TestSuiteTreeSelector' })
    const ids = selector.props('selectedCaseIds') as Set<number>
    expect(ids.has(42)).toBe(true)
    expect(ids.has(43)).toBe(true)
  })

  it('refetches again when the dialog is closed and reopened', async () => {
    vi.mocked(testSuitesApi.getTestSuites).mockResolvedValue([
      buildSuite(1) as never
    ])
    vi.mocked(testCasesApi.getTestCases).mockResolvedValue(
      pageOf([buildCase(42, 1)]) as never
    )

    const wrapper = mountDialog({ initialIds: [42] })
    await flushPromises()
    expect(testSuitesApi.getTestSuites).toHaveBeenCalledTimes(1)
    expect(testCasesApi.getTestCases).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ visible: false })
    await flushPromises()
    await wrapper.setProps({ visible: true })
    await flushPromises()

    expect(testSuitesApi.getTestSuites).toHaveBeenCalledTimes(2)
    expect(testCasesApi.getTestCases).toHaveBeenCalledTimes(2)
  })

  it('prunes initial selection ids that no longer exist and warns', async () => {
    vi.mocked(testSuitesApi.getTestSuites).mockResolvedValue([
      buildSuite(1) as never
    ])
    vi.mocked(testCasesApi.getTestCases).mockResolvedValue(
      pageOf([buildCase(42, 1)]) as never
    )

    const wrapper = mountDialog({ initialIds: [42, 99] })
    await flushPromises()

    const selector = wrapper.findComponent({ name: 'TestSuiteTreeSelector' })
    const ids = selector.props('selectedCaseIds') as Set<number>
    expect(ids.has(42)).toBe(true)
    expect(ids.has(99)).toBe(false)

    expect(toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn' })
    )
  })

  it('save calls setRunCases with the current selection and refetches', async () => {
    vi.mocked(testSuitesApi.getTestSuites).mockResolvedValue([
      buildSuite(1) as never
    ])
    vi.mocked(testCasesApi.getTestCases).mockResolvedValue(
      pageOf([buildCase(5, 1), buildCase(6, 1), buildCase(7, 1)]) as never
    )

    const updated = {
      id: 1,
      project_id: 10,
      suite_id: null,
      milestone_id: null,
      name: 'Run',
      config: null,
      assigned_to: null,
      status: 'active' as const,
      cases_mode: 'explicit' as const,
      created_at: '',
      completed_at: null
    }
    vi.mocked(testRunsApi.setRunCases).mockResolvedValueOnce(updated)
    vi.mocked(testRunsApi.getTestRunCases).mockResolvedValueOnce({
      run: updated,
      cases: []
    })
    vi.mocked(testRunsApi.getTestRunProgress).mockResolvedValueOnce({
      total: 0, passed: 0, failed: 0, blocked: 0, no_run: 0, pass_rate: null
    })

    const wrapper = mountDialog({ initialIds: [5, 6, 7] })
    await flushPromises()

    await wrapper.find('[data-testid="edit-cases-save"]').trigger('click')
    await flushPromises()

    expect(testRunsApi.setRunCases).toHaveBeenCalledWith(1, [5, 6, 7])
    expect(testRunsApi.getTestRunCases).toHaveBeenCalledWith(1)
    expect(testRunsApi.getTestRunProgress).toHaveBeenCalledWith(1)
    expect(wrapper.emitted('saved')?.[0]).toEqual([[5, 6, 7]])
    expect(wrapper.emitted('update:visible')?.pop()).toEqual([false])
  })

  it('save can submit an empty selection (remove all cases)', async () => {
    vi.mocked(testSuitesApi.getTestSuites).mockResolvedValue([
      buildSuite(1) as never
    ])
    vi.mocked(testCasesApi.getTestCases).mockResolvedValue(pageOf([]) as never)

    const run = {
      id: 1,
      project_id: 10,
      suite_id: null,
      milestone_id: null,
      name: 'R',
      config: null,
      assigned_to: null,
      status: 'active' as const,
      cases_mode: 'explicit' as const,
      created_at: '',
      completed_at: null
    }
    vi.mocked(testRunsApi.setRunCases).mockResolvedValueOnce(run)
    vi.mocked(testRunsApi.getTestRunCases).mockResolvedValueOnce({ run, cases: [] })
    vi.mocked(testRunsApi.getTestRunProgress).mockResolvedValueOnce({
      total: 0, passed: 0, failed: 0, blocked: 0, no_run: 0, pass_rate: null
    })

    const wrapper = mountDialog({ initialIds: [] })
    await flushPromises()

    await wrapper.find('[data-testid="edit-cases-save"]').trigger('click')
    await flushPromises()

    expect(testRunsApi.setRunCases).toHaveBeenCalledWith(1, [])
  })

  it('cancel emits update:visible false', async () => {
    vi.mocked(testSuitesApi.getTestSuites).mockResolvedValue([])
    const wrapper = mountDialog({})
    await flushPromises()

    await wrapper.find('[data-testid="edit-cases-cancel"]').trigger('click')

    expect(wrapper.emitted('update:visible')?.pop()).toEqual([false])
  })
})
