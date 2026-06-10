import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTagsStore } from '@/stores/tags'

vi.mock('@/api/tags', () => ({
  getTags: vi.fn(),
  searchTags: vi.fn(),
  createTag: vi.fn()
}))

import * as tagsApi from '@/api/tags'

const makeTag = (id: number, name = `Tag ${id}`) => ({ id, name })

describe('Tags Store', () => {
  let store: ReturnType<typeof useTagsStore>

  beforeEach(() => {
    store = useTagsStore()
  })

  describe('initial state', () => {
    it('starts with empty tags', () => {
      expect(store.tags).toEqual([])
    })

    it('starts with empty searchResults', () => {
      expect(store.searchResults).toEqual([])
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })
  })

  describe('fetchTags', () => {
    it('populates tags from API', async () => {
      const tags = [makeTag(1), makeTag(2)]
      vi.mocked(tagsApi.getTags).mockResolvedValueOnce(tags)

      await store.fetchTags()

      expect(store.tags).toHaveLength(2)
      expect(store.tags[0].id).toBe(1)
    })

    it('sets loading=false when complete', async () => {
      vi.mocked(tagsApi.getTags).mockResolvedValueOnce([])

      await store.fetchTags()

      expect(store.loading).toBe(false)
    })
  })

  describe('searchTags', () => {
    it('populates searchResults from API', async () => {
      const results = [makeTag(1, 'login')]
      vi.mocked(tagsApi.searchTags).mockResolvedValueOnce(results)

      await store.searchTags('log')

      expect(store.searchResults).toEqual(results)
    })

    it('ignores stale responses', async () => {
      const slow = [makeTag(1, 'old')]
      const fast = [makeTag(2, 'new')]

      let resolveFirst: (v: typeof slow) => void
      vi.mocked(tagsApi.searchTags)
        .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
        .mockResolvedValueOnce(fast)

      const first = store.searchTags('old')
      const second = store.searchTags('new')

      await second
      resolveFirst!(slow)
      await first

      expect(store.searchResults).toEqual(fast)
    })

    it('clears searchResults on error', async () => {
      store.searchResults = [makeTag(1)]
      vi.mocked(tagsApi.searchTags).mockRejectedValueOnce(new Error('fail'))

      await store.searchTags('x')

      expect(store.searchResults).toEqual([])
    })
  })

  describe('createTag', () => {
    it('returns the created tag and appends to tags list', async () => {
      store.tags = [makeTag(1)]
      const created = makeTag(2, 'New Tag')
      vi.mocked(tagsApi.createTag).mockResolvedValueOnce(created)

      const result = await store.createTag({ name: 'New Tag' })

      expect(result).toEqual(created)
      expect(store.tags).toHaveLength(2)
      expect(store.tags[1].name).toBe('New Tag')
    })

    it('propagates error on failure', async () => {
      vi.mocked(tagsApi.createTag).mockRejectedValueOnce(new Error('fail'))

      await expect(store.createTag({ name: 'X' })).rejects.toThrow('fail')
    })
  })
})
