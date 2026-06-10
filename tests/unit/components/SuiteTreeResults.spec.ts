import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SuiteTreeResults from '@/components/test-runs/SuiteTreeResults.vue'
import type { TestSuiteTree } from '@/types/testSuite'
import type { TestCaseWithResult } from '@/types/testRun'
import type { TestResult } from '@/types/testResult'

// happy-dom's localStorage returns undefined for missing keys and does not
// persist setItem values, so we install an in-memory Map-backed shim for
// the duration of the suite.
function installLocalStorageShim() {
  const store = new Map<string, string>()
  const shim: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: shim,
    writable: true,
    configurable: true,
  })
}

function buildCase(
  id: number,
  suiteId: number | null,
  overrides: Partial<TestCaseWithResult> = {},
): TestCaseWithResult {
  return {
    id,
    project_id: 10,
    suite_id: suiteId,
    title: `Case ${id}`,
    type: 'manual',
    priority: 'medium',
    status: 'active',
    steps: [],
    expected: null,
    preconditions: null,
    created_at: '',
    updated_at: '',
    result: null,
    ...overrides,
  } as never
}

function buildResult(caseId: number, status: TestResult['status']): TestResult {
  return {
    id: caseId * 100,
    test_run_id: 1,
    test_case_id: caseId,
    status,
    comment: null,
    message: null,
    stack_trace: null,
    execution_time: null,
    defects: [],
    tested_by: null,
    tested_at: '',
    step_results: null,
    attachments: [],
  }
}

const suiteTree: TestSuiteTree[] = [
  {
    id: 1,
    name: 'Smoke',
    project_id: 10,
    parent_suite_id: null,
    order_index: 0,
    created_at: '',
    updated_at: '',
    level: 0,
    expanded: true,
    children: [
      {
        id: 2,
        name: 'Critical Paths',
        project_id: 10,
        parent_suite_id: 1,
        order_index: 0,
        created_at: '',
        updated_at: '',
        level: 1,
        expanded: true,
        children: [],
      } as never,
    ],
  } as never,
  {
    id: 3,
    name: 'Regression',
    project_id: 10,
    parent_suite_id: null,
    order_index: 1,
    created_at: '',
    updated_at: '',
    level: 0,
    expanded: true,
    children: [],
  } as never,
]

describe('SuiteTreeResults', () => {
  beforeEach(() => {
    installLocalStorageShim()
  })

  it('renders nested branches with per-suite counts', () => {
    const cases = [
      buildCase(10, 1),
      buildCase(11, 2),
      buildCase(12, 3),
    ]
    const results = [
      buildResult(10, 'passed'),
      buildResult(11, 'failed'),
    ]

    const wrapper = mount(SuiteTreeResults, {
      props: {
        cases,
        results,
        suiteTree,
        mode: 'read',
        runId: 1,
      },
      global: { stubs: { StatusBadge: true, Tag: true } },
    })

    const branches = wrapper.findAllComponents({ name: 'SuiteTreeBranch' })
    expect(branches.length).toBeGreaterThanOrEqual(2) // Smoke + Regression roots
    // Three rows total across branches
    const rows = wrapper.findAll('[data-testid="suite-tree-result-row"]')
    expect(rows.length).toBe(3)
  })

  it('execute mode renders compact case rows', () => {
    const cases = [buildCase(10, 1), buildCase(11, 3)]
    const wrapper = mount(SuiteTreeResults, {
      props: {
        cases,
        results: [],
        suiteTree,
        mode: 'execute',
        runId: 1,
      },
      global: { stubs: { StatusBadge: true, Tag: true } },
    })
    const rows = wrapper.findAll('[data-testid="execution-test-case-item"]')
    expect(rows.length).toBe(2)
  })

  it('emits select(caseId) when a row is clicked', async () => {
    const cases = [buildCase(42, 1)]
    const wrapper = mount(SuiteTreeResults, {
      props: {
        cases,
        results: [],
        suiteTree,
        mode: 'execute',
        runId: 1,
      },
      global: { stubs: { StatusBadge: true, Tag: true } },
    })
    await wrapper.find('[data-testid="execution-test-case-item"]').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual([42])
  })

  it('findNextUntestedAfter walks the tree in DFS render order', () => {
    const cases = [
      buildCase(10, 1), // Smoke direct
      buildCase(11, 2), // Smoke > Critical Paths
      buildCase(12, 3), // Regression
    ]
    const results = [buildResult(10, 'passed')] // Smoke direct done

    const wrapper = mount(SuiteTreeResults, {
      props: {
        cases,
        results,
        suiteTree,
        mode: 'execute',
        runId: 1,
      },
      global: { stubs: { StatusBadge: true, Tag: true } },
    })

    const exposed = wrapper.vm as unknown as {
      findNextUntestedAfter: (id: number | null) => { id: number } | null
    }
    // From case 10 (passed), next no_run should be 11 (Smoke > Critical Paths)
    expect(exposed.findNextUntestedAfter(10)?.id).toBe(11)
    // From case 11, next should be 12 (Regression root)
    expect(exposed.findNextUntestedAfter(11)?.id).toBe(12)
    // After 12 there are no more no_run cases
    expect(exposed.findNextUntestedAfter(12)).toBeNull()
  })

  it('persists collapse state in localStorage keyed by runId', async () => {
    const cases = [buildCase(10, 1)]
    const wrapper = mount(SuiteTreeResults, {
      props: {
        cases,
        results: [],
        suiteTree,
        mode: 'execute',
        runId: 42,
      },
      global: { stubs: { StatusBadge: true, Tag: true } },
    })

    const header = wrapper.find('.suite-branch-header')
    await header.trigger('click')

    const raw = localStorage.getItem('testoria.suiteTree.collapsed')
    expect(raw).toBeTruthy()
    expect(raw).not.toBe('undefined')
    const parsed = JSON.parse(raw as string)
    expect(parsed['42']).toBeTruthy()
    expect(parsed['42']['1']).toBe(true)
  })
})
