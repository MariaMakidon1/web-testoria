import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTestResultsStore } from '@/stores/testResults'

vi.mock('@/api/testResults', () => ({
  getTestResults: vi.fn(),
  getTestResult: vi.fn(),
  getTestResultHistory: vi.fn(),
  submitTestResult: vi.fn(),
  updateTestResult: vi.fn(),
  uploadAttachment: vi.fn(),
  uploadAttachmentsBulk: vi.fn(),
  deleteAttachment: vi.fn()
}))

vi.mock('@/mock/data/testRuns', () => ({
  updateTestRunProgress: vi.fn()
}))

const testRunsStoreMock = { updateTestRunProgress: vi.fn() }
vi.mock('@/stores/testRuns', () => ({
  useTestRunsStore: vi.fn(() => testRunsStoreMock)
}))

import * as testResultsApi from '@/api/testResults'
import type { TestResultHistory } from '@/types/testResult'

const makeResult = (
  id: number,
  testCaseId = id,
  status: 'passed' | 'failed' | 'blocked' | 'no_run' = 'passed'
) => ({
  id,
  test_run_id: 10,
  test_case_id: testCaseId,
  status,
  comment: null,
  message: null,
  stack_trace: null,
  execution_time: null,
  defects: null,
  tested_by: null,
  tested_at: '2024-01-01T00:00:00Z'
})

describe('TestResults Store', () => {
  let store: ReturnType<typeof useTestResultsStore>

  beforeEach(() => {
    testRunsStoreMock.updateTestRunProgress.mockClear()
    store = useTestResultsStore()
    store.clearResults()
  })

  describe('initial state', () => {
    it('starts with empty results', () => {
      expect(store.results).toEqual([])
    })

    it('starts not loading', () => {
      expect(store.loading).toBe(false)
    })

    it('starts not submitting', () => {
      expect(store.submitting).toBe(false)
    })

    it('starts with no current result', () => {
      expect(store.currentResult).toBeNull()
    })
  })

  describe('fetchResults', () => {
    it('populates results from API', async () => {
      const apiResults = [makeResult(1), makeResult(2)]
      vi.mocked(testResultsApi.getTestResults).mockResolvedValueOnce(apiResults)

      await store.fetchResults(10)

      expect(store.results).toHaveLength(2)
      expect(store.results[0].id).toBe(1)
    })

    it('sets loading=false when done', async () => {
      vi.mocked(testResultsApi.getTestResults).mockResolvedValueOnce([])
      await store.fetchResults(10)
      expect(store.loading).toBe(false)
    })

    it('sets error and throws on API failure', async () => {
      vi.mocked(testResultsApi.getTestResults).mockRejectedValueOnce(new Error('Network'))

      await expect(store.fetchResults(10)).rejects.toThrow('Network')
      expect(store.error).toBe('Failed to load test results')
    })
  })

  describe('submitResult', () => {
    it('returns submitted result', async () => {
      const result = makeResult(42, 1, 'passed')
      vi.mocked(testResultsApi.submitTestResult).mockResolvedValueOnce(result)

      const returned = await store.submitResult(10, { test_case_id: 1, status: 'passed' })

      expect(returned.id).toBe(42)
      expect(returned.status).toBe('passed')
    })

    it('adds result to list when test case not in results', async () => {
      const result = makeResult(42, 1, 'passed')
      vi.mocked(testResultsApi.submitTestResult).mockResolvedValueOnce(result)

      await store.submitResult(10, { test_case_id: 1, status: 'passed' })

      expect(store.results).toHaveLength(1)
      expect(store.results[0].id).toBe(42)
    })

    it('upserts result when test case already in results', async () => {
      store.results = [makeResult(1, 1, 'no_run')]
      const updated = makeResult(1, 1, 'passed')
      vi.mocked(testResultsApi.submitTestResult).mockResolvedValueOnce(updated)

      await store.submitResult(10, { test_case_id: 1, status: 'passed' })

      expect(store.results).toHaveLength(1)
      expect(store.results[0].status).toBe('passed')
    })

    it('propagates error when API fails', async () => {
      vi.mocked(testResultsApi.submitTestResult).mockRejectedValueOnce(new Error('Network'))

      await expect(store.submitResult(10, { test_case_id: 5, status: 'failed' })).rejects.toThrow('Network')
    })

    it('sets submitting=false after completion', async () => {
      vi.mocked(testResultsApi.submitTestResult).mockResolvedValueOnce(makeResult(1, 1, 'passed'))
      await store.submitResult(10, { test_case_id: 1, status: 'passed' })
      expect(store.submitting).toBe(false)
    })

    it('syncs progress to test run after submit', async () => {
      vi.mocked(testResultsApi.submitTestResult).mockResolvedValueOnce(makeResult(1, 1, 'passed'))

      await store.submitResult(10, { test_case_id: 1, status: 'passed' })

      expect(testRunsStoreMock.updateTestRunProgress).toHaveBeenCalledWith(10, expect.objectContaining({
        passed: 1
      }))
    })
  })

  describe('updateResult', () => {
    it('updates result in list', async () => {
      store.results = [makeResult(1, 1, 'no_run')]
      const updated = makeResult(1, 1, 'passed')
      vi.mocked(testResultsApi.updateTestResult).mockResolvedValueOnce(updated)

      await store.updateResult(1, { status: 'passed' })

      expect(store.results[0].status).toBe('passed')
    })

    it('updates currentResult when id matches', async () => {
      store.results = [makeResult(1, 1, 'no_run')]
      store.currentResult = makeResult(1, 1, 'no_run')
      const updated = makeResult(1, 1, 'passed')
      vi.mocked(testResultsApi.updateTestResult).mockResolvedValueOnce(updated)

      await store.updateResult(1, { status: 'passed' })

      expect(store.currentResult?.status).toBe('passed')
    })

    it('propagates error when API fails', async () => {
      store.results = [makeResult(1, 1, 'no_run')]
      vi.mocked(testResultsApi.updateTestResult).mockRejectedValueOnce(new Error('Network'))

      await expect(store.updateResult(1, { status: 'blocked' })).rejects.toThrow('Network')
    })
  })

  describe('progress sync', () => {
    it('syncProgressToTestRun is called on fetchResults when results present', async () => {
      vi.mocked(testResultsApi.getTestResults).mockResolvedValueOnce([makeResult(1, 1, 'passed')])

      await store.fetchResults(10)

      expect(testRunsStoreMock.updateTestRunProgress).toHaveBeenCalledWith(10, expect.objectContaining({
        total: 1,
        passed: 1
      }))
    })

    it('pass_rate is calculated from all results', async () => {
      vi.mocked(testResultsApi.getTestResults).mockResolvedValueOnce([
        makeResult(1, 1, 'passed'),
        makeResult(2, 2, 'failed'),
        makeResult(3, 3, 'blocked')
      ])

      await store.fetchResults(10)

      // pass_rate is a 0..1 ratio (api plan 035 / fixed under plan-083 —
      // was previously stored as a 0..100 percent here by mistake).
      expect(testRunsStoreMock.updateTestRunProgress).toHaveBeenCalledWith(10, expect.objectContaining({
        passed: 1,
        pass_rate: expect.closeTo(1 / 3, 3)
      }))
    })
  })



  describe('fetchHistory', () => {
    const makeHistoryEntry = (id: number): TestResultHistory => ({
      id,
      test_result_id: 1,
      status: 'passed',
      comment: null,
      changed_by: 1,
      changed_at: '2024-01-01T00:00:00Z'
    })

    it('stores history entries keyed by result id', async () => {
      const entries = [makeHistoryEntry(1), makeHistoryEntry(2)]
      vi.mocked(testResultsApi.getTestResultHistory).mockResolvedValueOnce(entries)

      await store.fetchHistory(42)

      expect(store.history[42]).toHaveLength(2)
    })

    it('stores empty array when API returns empty history', async () => {
      vi.mocked(testResultsApi.getTestResultHistory).mockResolvedValueOnce([])

      await store.fetchHistory(99)

      expect(store.history[99]).toEqual([])
    })

    it('propagates error on API failure', async () => {
      vi.mocked(testResultsApi.getTestResultHistory).mockRejectedValueOnce(new Error('Network'))

      await expect(store.fetchHistory(77)).rejects.toThrow('Network')
    })

    it('caches multiple results independently', async () => {
      vi.mocked(testResultsApi.getTestResultHistory).mockResolvedValueOnce([makeHistoryEntry(1)])
      await store.fetchHistory(1)
      vi.mocked(testResultsApi.getTestResultHistory).mockResolvedValueOnce([makeHistoryEntry(2), makeHistoryEntry(3)])
      await store.fetchHistory(2)

      expect(store.history[1]).toHaveLength(1)
      expect(store.history[2]).toHaveLength(2)
    })
  })

  describe('setCurrentResult / clearResults', () => {
    it('setCurrentResult updates currentResult', () => {
      store.setCurrentResult(makeResult(1))
      expect(store.currentResult?.id).toBe(1)
    })

    it('clearResults empties results and currentResult', () => {
      store.results = [makeResult(1)]
      store.currentResult = makeResult(1)

      store.clearResults()

      expect(store.results).toEqual([])
      expect(store.currentResult).toBeNull()
    })
  })

  describe('uploadAttachmentsBulk', () => {
    it('merges uploaded attachments into the matching result row', async () => {
      store.results = [makeResult(100, 1), makeResult(200, 2)]
      const att1 = {
        id: 11,
        filename: 'a.png',
        file_size: 123,
        mime_type: 'image/png',
        uploaded_at: '2024-01-01',
        url: 'http://x/a',
      }
      const att2 = {
        id: 12,
        filename: 'b.png',
        file_size: 200,
        mime_type: 'image/png',
        uploaded_at: '2024-01-01',
        url: 'http://x/b',
      }
      vi.mocked(testResultsApi.uploadAttachmentsBulk).mockResolvedValue({
        uploaded: [att1, att2],
        failed: [],
      })

      const response = await store.uploadAttachmentsBulk(100, [
        new File([], 'a.png'),
        new File([], 'b.png'),
      ])

      expect(response.uploaded).toHaveLength(2)
      expect(response.failed).toHaveLength(0)
      const target = store.results.find((r) => r.id === 100)
      expect(target?.attachments).toHaveLength(2)
      expect(target?.attachments?.map((a) => a.id)).toEqual([11, 12])
      // Sibling row untouched.
      const sibling = store.results.find((r) => r.id === 200)
      expect(sibling?.attachments).toBeUndefined()
    })

    it('surfaces partial failures in the response', async () => {
      store.results = [makeResult(100, 1)]
      vi.mocked(testResultsApi.uploadAttachmentsBulk).mockResolvedValue({
        uploaded: [],
        failed: [{ filename: 'bad.png', reason: 'unsupported' }],
      })
      const resp = await store.uploadAttachmentsBulk(100, [
        new File([], 'bad.png'),
      ])
      expect(resp.failed).toHaveLength(1)
      expect(resp.uploaded).toHaveLength(0)
    })

    it('deleteAttachment removes from in-place list', async () => {
      const row = makeResult(100, 1)
      row.attachments = [
        {
          id: 55,
          filename: 'x.png',
          file_size: 1,
          mime_type: 'image/png',
          uploaded_at: '2024-01-01',
          url: 'http://x',
        },
      ] as never
      store.results = [row]
      vi.mocked(testResultsApi.deleteAttachment).mockResolvedValue(undefined)

      await store.deleteAttachment(100, 55)

      expect(store.results[0].attachments).toEqual([])
    })
  })
})
