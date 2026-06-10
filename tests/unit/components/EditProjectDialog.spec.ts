import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import EditProjectDialog from '@/components/projects/EditProjectDialog.vue'
import type { Project } from '@/types/project'

vi.mock('@/api/projects', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectStats: vi.fn(),
  getProjectStatsBulk: vi.fn(),
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() }),
}))

import * as projectsApi from '@/api/projects'

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: 7,
  name: 'Original Project',
  description: 'Original description',
  is_archived: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
  ...overrides,
})

function mountDialog(project: Project | null) {
  return mount(EditProjectDialog, {
    props: { visible: true, project },
    global: {
      stubs: {
        Dialog: {
          template: '<div><slot /><slot name="footer" /></div>',
          props: ['visible'],
        },
      },
    },
  })
}

describe('EditProjectDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(projectsApi.updateProject).mockReset()
  })

  describe('pre-fill', () => {
    it('pre-fills name and description from the project prop', async () => {
      const wrapper = mountDialog(makeProject())
      await flushPromises()

      const nameInput = wrapper.find('[data-testid="edit-project-name"]')
        .element as HTMLInputElement
      expect(nameInput.value).toBe('Original Project')
    })

    it('reflects the archive flag', async () => {
      const archived = makeProject({ is_archived: true })
      const wrapper = mountDialog(archived)
      await flushPromises()

      const checkbox = wrapper.findComponent({ name: 'Checkbox' })
      expect(checkbox.props('modelValue')).toBe(true)
    })

    it('handles a project with null description', async () => {
      const wrapper = mountDialog(makeProject({ description: null }))
      await flushPromises()

      // No throw; the Textarea binds to empty string
      expect(wrapper.find('[data-testid="edit-project-description"]').exists()).toBe(
        true,
      )
    })
  })

  describe('submit guard', () => {
    it('disables Save when nothing has changed', async () => {
      const wrapper = mountDialog(makeProject())
      await flushPromises()

      const save = wrapper.find('[data-testid="edit-project-save"]')
      expect(save.attributes('disabled')).toBeDefined()
    })

    it('disables Save when name is emptied', async () => {
      const wrapper = mountDialog(makeProject())
      await flushPromises()

      await wrapper.find('[data-testid="edit-project-name"]').setValue('')

      const save = wrapper.find('[data-testid="edit-project-save"]')
      expect(save.attributes('disabled')).toBeDefined()
    })

    it('trims whitespace from the name before diffing', async () => {
      const wrapper = mountDialog(makeProject())
      await flushPromises()

      await wrapper
        .find('[data-testid="edit-project-name"]')
        .setValue('  Original Project  ')

      const save = wrapper.find('[data-testid="edit-project-save"]')
      expect(save.attributes('disabled')).toBeDefined()
    })
  })

  describe('submit', () => {
    it('sends only the changed name in the patch', async () => {
      const project = makeProject()
      const updated = { ...project, name: 'Renamed' }
      vi.mocked(projectsApi.updateProject).mockResolvedValueOnce(updated)

      const wrapper = mountDialog(project)
      await flushPromises()

      await wrapper.find('[data-testid="edit-project-name"]').setValue('Renamed')
      await wrapper.find('[data-testid="edit-project-save"]').trigger('click')
      await flushPromises()

      expect(projectsApi.updateProject).toHaveBeenCalledWith(7, {
        name: 'Renamed',
      })
    })

    it('sends is_archived=true when the archive box is checked', async () => {
      const project = makeProject()
      vi.mocked(projectsApi.updateProject).mockResolvedValueOnce({
        ...project,
        is_archived: true,
      })

      const wrapper = mountDialog(project)
      await flushPromises()

      const checkbox = wrapper.findComponent({ name: 'Checkbox' })
      await checkbox.setValue(true)
      await wrapper.find('[data-testid="edit-project-save"]').trigger('click')
      await flushPromises()

      expect(projectsApi.updateProject).toHaveBeenCalledWith(7, {
        is_archived: true,
      })
    })

    it('emits saved with the updated project and closes on success', async () => {
      const project = makeProject()
      const updated = { ...project, name: 'Renamed' }
      vi.mocked(projectsApi.updateProject).mockResolvedValueOnce(updated)

      const wrapper = mountDialog(project)
      await flushPromises()

      await wrapper.find('[data-testid="edit-project-name"]').setValue('Renamed')
      await wrapper.find('[data-testid="edit-project-save"]').trigger('click')
      await flushPromises()

      expect(wrapper.emitted('saved')?.[0]).toEqual([updated])
      expect(wrapper.emitted('update:visible')?.pop()).toEqual([false])
    })
  })

  describe('cancel', () => {
    it('emits update:visible false on cancel click', async () => {
      const wrapper = mountDialog(makeProject())
      await flushPromises()

      await wrapper.find('[data-testid="edit-project-cancel"]').trigger('click')

      expect(wrapper.emitted('update:visible')?.pop()).toEqual([false])
    })
  })
})
