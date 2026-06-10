import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectsStore } from '@/stores/projects'

vi.mock('@/api/projects', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getProjectStats: vi.fn(),
  getProjectStatsBulk: vi.fn()
}))

import * as projectsApi from '@/api/projects'

const makeProject = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Project ${id}`,
  description: null,
  is_archived: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
  ...overrides
})

const makePaginatedResponse = (items: ReturnType<typeof makeProject>[]) => ({
  items,
  total: items.length,
  page: 1,
  page_size: 50,
  total_pages: 1
})

const makeStats = () => ({
  total_test_cases: 10,
  total_test_runs: 3,
  total_test_suites: 5,
  pass_rate: 80
})

describe('Projects Store', () => {
  let store: ReturnType<typeof useProjectsStore>

  beforeEach(() => {
    store = useProjectsStore()
    store.projects = []
    store.currentProject = null
    store.projectStats = null
  })

  describe('initial state', () => {
    it('starts with no current project', () => {
      expect(store.currentProject).toBeNull()
    })

    it('starts with no stats', () => {
      expect(store.projectStats).toBeNull()
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchProjects', () => {
    it('populates projects from paginated API response', async () => {
      const projects = [makeProject(1), makeProject(2)]
      vi.mocked(projectsApi.getProjects).mockResolvedValueOnce(makePaginatedResponse(projects))

      await store.fetchProjects()

      expect(store.projects).toHaveLength(2)
      expect(store.projects[0].id).toBe(1)
    })

    it('updates pagination state', async () => {
      vi.mocked(projectsApi.getProjects).mockResolvedValueOnce({
        items: [makeProject(1)],
        total: 25,
        page: 2,
        page_size: 10,
        total_pages: 3
      })

      await store.fetchProjects({ page: 2, page_size: 10 })

      expect(store.pagination.total).toBe(25)
      expect(store.pagination.page).toBe(2)
      expect(store.pagination.total_pages).toBe(3)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(projectsApi.getProjects).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchProjects()).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load projects')
    })

    it('forwards include_archived to the API', async () => {
      vi.mocked(projectsApi.getProjects).mockResolvedValueOnce(makePaginatedResponse([]))

      await store.fetchProjects({ include_archived: true })

      expect(projectsApi.getProjects).toHaveBeenCalledWith(
        expect.objectContaining({ include_archived: true })
      )
    })

    it('does not include include_archived when omitted', async () => {
      vi.mocked(projectsApi.getProjects).mockResolvedValueOnce(makePaginatedResponse([]))

      await store.fetchProjects()

      const call = vi.mocked(projectsApi.getProjects).mock.calls[0][0]
      expect(call).not.toHaveProperty('include_archived')
    })
  })

  describe('fetchProject', () => {
    it('sets currentProject from API response', async () => {
      const project = makeProject(1)
      vi.mocked(projectsApi.getProject).mockResolvedValueOnce(project)

      await store.fetchProject(1)

      expect(store.currentProject).toEqual(project)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(projectsApi.getProject).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchProject(1)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load project')
    })

    it('sets loading=false when done', async () => {
      vi.mocked(projectsApi.getProject).mockResolvedValueOnce(makeProject(1))

      await store.fetchProject(1)

      expect(store.loading).toBe(false)
    })
  })

  describe('fetchProjectStats', () => {
    it('populates projectStats from API', async () => {
      const stats = makeStats()
      vi.mocked(projectsApi.getProjectStats).mockResolvedValueOnce(stats)

      await store.fetchProjectStats(1)

      expect(store.projectStats).toEqual(stats)
    })

    it('exposes total_test_suites in stats', async () => {
      const stats = makeStats()
      vi.mocked(projectsApi.getProjectStats).mockResolvedValueOnce(stats)

      await store.fetchProjectStats(1)

      expect(store.projectStats?.total_test_suites).toBe(5)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(projectsApi.getProjectStats).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchProjectStats(1)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load project stats')
    })
  })

  describe('archived flag', () => {
    it('currentProject reflects is_archived=true', async () => {
      const archived = makeProject(1, { is_archived: true })
      vi.mocked(projectsApi.getProject).mockResolvedValueOnce(archived)

      await store.fetchProject(1)

      expect(store.currentProject?.is_archived).toBe(true)
    })

    it('currentProject reflects is_archived=false', async () => {
      const active = makeProject(1, { is_archived: false })
      vi.mocked(projectsApi.getProject).mockResolvedValueOnce(active)

      await store.fetchProject(1)

      expect(store.currentProject?.is_archived).toBe(false)
    })

    it('updateProject can archive a project', async () => {
      const original = makeProject(1)
      store.projects = [original]
      store.currentProject = original
      const archived = { ...original, is_archived: true, updated_at: '2024-06-01T00:00:00Z' }
      vi.mocked(projectsApi.updateProject).mockResolvedValueOnce(archived)

      await store.updateProject(1, { is_archived: true })

      expect(store.currentProject?.is_archived).toBe(true)
      expect(store.projects[0].is_archived).toBe(true)
    })
  })

  describe('createProject', () => {
    it('prepends the new project to the list', async () => {
      const created = makeProject(42, { name: 'New Project' })
      vi.mocked(projectsApi.createProject).mockResolvedValueOnce(created)

      await store.createProject({ name: 'New Project' })

      expect(store.projects[0].id).toBe(42)
    })

    it('propagates error when API fails', async () => {
      vi.mocked(projectsApi.createProject).mockRejectedValueOnce(new Error('Network error'))

      await expect(store.createProject({ name: 'Local Project' })).rejects.toThrow('Network error')
    })
  })

  describe('updateProject', () => {
    it('updates the project in the list', async () => {
      const original = makeProject(1)
      store.projects = [original]
      const updated = { ...original, name: 'Renamed' }
      vi.mocked(projectsApi.updateProject).mockResolvedValueOnce(updated)

      await store.updateProject(1, { name: 'Renamed' })

      expect(store.projects[0].name).toBe('Renamed')
    })

    it('updates currentProject when it matches', async () => {
      const original = makeProject(1)
      store.projects = [original]
      store.currentProject = original
      const updated = { ...original, name: 'Renamed' }
      vi.mocked(projectsApi.updateProject).mockResolvedValueOnce(updated)

      await store.updateProject(1, { name: 'Renamed' })

      expect(store.currentProject?.name).toBe('Renamed')
    })
  })

  describe('deleteProject', () => {
    it('removes the project from the list', async () => {
      store.projects = [makeProject(1), makeProject(2)]
      vi.mocked(projectsApi.deleteProject).mockResolvedValueOnce(undefined)

      await store.deleteProject(1)

      expect(store.projects).toHaveLength(1)
      expect(store.projects[0].id).toBe(2)
    })

    it('clears currentProject when deleted project matches', async () => {
      store.projects = [makeProject(1)]
      store.currentProject = makeProject(1)
      vi.mocked(projectsApi.deleteProject).mockResolvedValueOnce(undefined)

      await store.deleteProject(1)

      expect(store.currentProject).toBeNull()
    })
  })

  describe('clearCurrentProject', () => {
    it('resets currentProject and projectStats to null', () => {
      store.currentProject = makeProject(1)
      store.projectStats = makeStats()

      store.clearCurrentProject()

      expect(store.currentProject).toBeNull()
      expect(store.projectStats).toBeNull()
    })
  })

  describe('fetchBulkStats', () => {
    it('populates bulkStats from API response items', async () => {
      vi.mocked(projectsApi.getProjectStatsBulk).mockResolvedValueOnce({
        items: [
          {
            project_id: 1,
            name: 'Alpha',
            is_archived: false,
            total_test_cases: 10,
            total_test_suites: 2,
            total_test_runs: 3,
            active_runs: 1,
            pass_rate: 0.8
          },
          {
            project_id: 2,
            name: 'Beta',
            is_archived: false,
            total_test_cases: 0,
            total_test_suites: 0,
            total_test_runs: 0,
            active_runs: 0,
            pass_rate: null
          }
        ],
        total: 2
      })

      await store.fetchBulkStats()

      expect(store.bulkStats).toHaveLength(2)
      expect(store.bulkStats[0].project_id).toBe(1)
      expect(store.bulkStats[1].pass_rate).toBeNull()
    })

    it('passes project_ids and include_archived to the API', async () => {
      vi.mocked(projectsApi.getProjectStatsBulk).mockResolvedValueOnce({
        items: [],
        total: 0
      })

      await store.fetchBulkStats({ project_ids: [5, 6], include_archived: true })

      expect(projectsApi.getProjectStatsBulk).toHaveBeenCalledWith({
        project_ids: [5, 6],
        include_archived: true
      })
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(projectsApi.getProjectStatsBulk).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(store.fetchBulkStats()).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load project stats')
    })
  })

  describe('selectedProject computed', () => {
    it('returns the project matching selectedProjectId', () => {
      store.projects = [makeProject(1), makeProject(2)]
      store.setSelectedProject(2)

      expect(store.selectedProject?.id).toBe(2)
    })

    it('returns null when no project is selected', () => {
      store.setSelectedProject(null)

      expect(store.selectedProject).toBeNull()
    })
  })
})
