import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EditTestRunDialog from '@/components/test-runs/EditTestRunDialog.vue'
import type { TestRun } from '@/types/testRun'

vi.mock('@/api/testRuns', () => ({
  getTestRuns: vi.fn(),
  getTestRun: vi.fn(),
  createTestRun: vi.fn(),
  updateTestRun: vi.fn(),
  deleteTestRun: vi.fn(),
  closeTestRun: vi.fn()
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

import * as testRunsApi from '@/api/testRuns'

const makeRun = (overrides: Partial<TestRun> = {}): TestRun => ({
  id: 1,
  project_id: 10,
  suite_id: null,
  milestone_id: null,
  name: 'Original Name',
  config: {
    environment: 'QA',
    browser: 'Chrome',
    build_number: 'v1.0.0'
  },
  assigned_to: null,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  completed_at: null,
  ...overrides
})

function mountDialog(run: TestRun | null) {
  return mount(EditTestRunDialog, {
    props: { visible: true, testRun: run },
    global: {
      stubs: {
        Dialog: {
          template: '<div><slot /><slot name="footer" /></div>',
          props: ['visible']
        }
      }
    }
  })
}

describe('EditTestRunDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(testRunsApi.updateTestRun).mockReset()
  })

  describe('pre-fill', () => {
    it('pre-fills form fields from the run prop', async () => {
      const run = makeRun()
      const wrapper = mountDialog(run)
      await flushPromises()

      const nameInput = wrapper.find('[data-testid="edit-run-name"]')
        .element as HTMLInputElement
      expect(nameInput.value).toBe('Original Name')
    })

    it('handles a run with no config', async () => {
      const run = makeRun({ config: null })
      const wrapper = mountDialog(run)
      await flushPromises()

      const nameInput = wrapper.find('[data-testid="edit-run-name"]')
        .element as HTMLInputElement
      expect(nameInput.value).toBe('Original Name')
    })
  })

  describe('submit', () => {
    it('disables save when nothing has changed', async () => {
      const wrapper = mountDialog(makeRun())
      await flushPromises()

      const save = wrapper.find('[data-testid="edit-run-save"]')
      expect(save.attributes('disabled')).toBeDefined()
    })

    it('disables save when name is empty', async () => {
      const wrapper = mountDialog(makeRun())
      await flushPromises()

      const input = wrapper.find('[data-testid="edit-run-name"]')
      await input.setValue('')

      const save = wrapper.find('[data-testid="edit-run-save"]')
      expect(save.attributes('disabled')).toBeDefined()
    })

    it('sends only the changed name in the patch', async () => {
      const run = makeRun()
      const updated = { ...run, name: 'New Name' }
      vi.mocked(testRunsApi.updateTestRun).mockResolvedValueOnce(updated)

      const wrapper = mountDialog(run)
      await flushPromises()

      await wrapper.find('[data-testid="edit-run-name"]').setValue('New Name')
      await wrapper.find('[data-testid="edit-run-save"]').trigger('click')
      await flushPromises()

      expect(testRunsApi.updateTestRun).toHaveBeenCalledWith(1, {
        name: 'New Name'
      })
    })

    it('sends only changed config fields, keeping the unchanged ones out', async () => {
      const run = makeRun()
      vi.mocked(testRunsApi.updateTestRun).mockResolvedValueOnce(run)

      const wrapper = mountDialog(run)
      await flushPromises()

      await wrapper
        .find('[data-testid="edit-run-build"]')
        .setValue('v2.0.0')
      await wrapper.find('[data-testid="edit-run-save"]').trigger('click')
      await flushPromises()

      expect(testRunsApi.updateTestRun).toHaveBeenCalledWith(1, {
        config: { build_number: 'v2.0.0' }
      })
    })

    it('trims whitespace from the name before diffing', async () => {
      const run = makeRun()
      const wrapper = mountDialog(run)
      await flushPromises()

      await wrapper
        .find('[data-testid="edit-run-name"]')
        .setValue('  Original Name  ')

      const save = wrapper.find('[data-testid="edit-run-save"]')
      expect(save.attributes('disabled')).toBeDefined()
    })

    it('emits saved with the updated run and closes on success', async () => {
      const run = makeRun()
      const updated = { ...run, name: 'New Name' }
      vi.mocked(testRunsApi.updateTestRun).mockResolvedValueOnce(updated)

      const wrapper = mountDialog(run)
      await flushPromises()

      await wrapper.find('[data-testid="edit-run-name"]').setValue('New Name')
      await wrapper.find('[data-testid="edit-run-save"]').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('saved')?.[0]).toEqual([updated])
      expect(wrapper.emitted('update:visible')?.pop()).toEqual([false])
    })
  })

  describe('cancel', () => {
    it('emits update:visible false', async () => {
      const wrapper = mountDialog(makeRun())
      await flushPromises()

      await wrapper.find('[data-testid="edit-run-cancel"]').trigger('click')

      expect(wrapper.emitted('update:visible')?.pop()).toEqual([false])
    })
  })
})
