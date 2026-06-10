import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useImport } from '@/composables/useImport'

// Mock ExcelJS so tests don't require a real XLSX file
vi.mock('exceljs', () => {
  class MockWorkbook {
    worksheets: { getSheetValues: () => (unknown[] | null)[] }[] = []
    xlsx = {
      load: vi.fn(async () => {
        // Simulate a worksheet with 2 data rows
        this.worksheets = [
          {
            getSheetValues: () => [
              null, // index 0 (1-indexed)
              [undefined, 'title', 'priority'], // header row
              [undefined, 'Case 1', 'High'],
              [undefined, 'Case 2', 'Medium']
            ]
          }
        ]
      })
    }
  }
  return { default: { Workbook: MockWorkbook } }
})

function makeFile(content: string, name = 'test.json'): File {
  return new File([content], name, { type: 'application/json' })
}

function makeExcelFile(): File {
  return new File([new ArrayBuffer(8)], 'test.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}

describe('useImport', () => {
  let importComposable: ReturnType<typeof useImport>

  beforeEach(() => {
    importComposable = useImport()
  })

  describe('initial state', () => {
    it('starts not importing', () => {
      expect(importComposable.importing.value).toBe(false)
    })

    it('starts with progress 0', () => {
      expect(importComposable.progress.value).toBe(0)
    })

    it('starts with no error', () => {
      expect(importComposable.error.value).toBeNull()
    })
  })

  describe('JSON import', () => {
    it('parses a valid JSON array', async () => {
      const data = [{ title: 'Case 1' }, { title: 'Case 2' }]
      const file = makeFile(JSON.stringify(data))

      const result = await importComposable.importFromFile(file, { format: 'json' })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.totalRows).toBe(2)
      expect(result.validRows).toBe(2)
    })

    it('wraps a single JSON object into an array', async () => {
      const file = makeFile(JSON.stringify({ title: 'Single Case' }))

      const result = await importComposable.importFromFile(file, { format: 'json' })

      expect(result.data).toHaveLength(1)
    })

    it('returns failure on invalid JSON', async () => {
      const file = makeFile('not valid json{{{')

      const result = await importComposable.importFromFile(file, { format: 'json' })

      expect(result.success).toBe(false)
      expect(result.errors).toContain('Invalid JSON format')
    })

    it('validates required fields and reports errors', async () => {
      const data = [{ title: 'Has Title' }, { priority: 'High' }]
      const file = makeFile(JSON.stringify(data))

      const result = await importComposable.importFromFile(file, {
        format: 'json',
        requiredFields: ['title']
      })

      expect(result.validRows).toBe(1)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('title')
    })

    it('applies validateRow predicate', async () => {
      const data = [{ title: 'Valid', priority: 'High' }, { title: '', priority: 'Low' }]
      const file = makeFile(JSON.stringify(data))

      const result = await importComposable.importFromFile(file, {
        format: 'json',
        validateRow: (row) => String(row.title).length > 0
      })

      expect(result.validRows).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    it('applies transformRow to each valid row', async () => {
      const data = [{ Title: 'Case 1' }]
      const file = makeFile(JSON.stringify(data))

      const result = await importComposable.importFromFile<{ title: string }>(file, {
        format: 'json',
        transformRow: (row) => ({ title: String(row.Title).toLowerCase() })
      })

      expect((result.data[0] as { title: string }).title).toBe('case 1')
    })

    it('sets progress to 100 on success', async () => {
      const file = makeFile(JSON.stringify([{ title: 'A' }]))

      await importComposable.importFromFile(file, { format: 'json' })

      expect(importComposable.progress.value).toBe(100)
    })

    it('sets importing=false after completion', async () => {
      const file = makeFile(JSON.stringify([]))

      await importComposable.importFromFile(file, { format: 'json' })

      expect(importComposable.importing.value).toBe(false)
    })
  })

  describe('Excel import', () => {
    it('parses rows from the first worksheet', async () => {
      const file = makeExcelFile()

      const result = await importComposable.importFromFile(file, { format: 'excel' })

      expect(result.success).toBe(true)
      expect(result.totalRows).toBe(2)
      expect(result.validRows).toBe(2)
    })

    it('normalizes header keys to snake_case', async () => {
      const file = makeExcelFile()

      const result = await importComposable.importFromFile<Record<string, string>>(file, {
        format: 'excel'
      })

      expect(Object.keys(result.data[0])).toContain('title')
      expect(Object.keys(result.data[0])).toContain('priority')
    })

    it('applies validateRow predicate', async () => {
      const file = makeExcelFile()

      const result = await importComposable.importFromFile(file, {
        format: 'excel',
        validateRow: (row) => String(row.priority) === 'High'
      })

      expect(result.validRows).toBe(1)
      expect(result.errors).toHaveLength(1)
    })

    it('applies transformRow to each valid row', async () => {
      const file = makeExcelFile()

      const result = await importComposable.importFromFile<{ title: string }>(file, {
        format: 'excel',
        transformRow: (row) => ({ title: String(row.title).toUpperCase() })
      })

      expect((result.data[0] as { title: string }).title).toBe('CASE 1')
    })

    it('sets importing=false after completion', async () => {
      const file = makeExcelFile()
      await importComposable.importFromFile(file, { format: 'excel' })
      expect(importComposable.importing.value).toBe(false)
    })
  })

  describe('CSV import', () => {
    it('parses a valid CSV file', async () => {
      const csv = 'title,priority\nCase 1,High\nCase 2,Medium'
      const file = makeFile(csv, 'test.csv')

      const result = await importComposable.importFromFile(file, { format: 'csv' })

      expect(result.success).toBe(true)
      expect(result.totalRows).toBe(2)
      expect(result.validRows).toBe(2)
    })

    it('normalizes header keys to snake_case', async () => {
      const csv = 'Test Title,Test Priority\nCase 1,High'
      const file = makeFile(csv, 'test.csv')

      const result = await importComposable.importFromFile<Record<string, string>>(file, {
        format: 'csv'
      })

      expect(Object.keys(result.data[0])).toContain('test_title')
    })

    it('returns failure for empty CSV', async () => {
      const file = makeFile('', 'empty.csv')

      const result = await importComposable.importFromFile(file, { format: 'csv' })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toBe('Empty file')
    })

    it('returns failure when required columns are missing', async () => {
      const csv = 'name,priority\nCase 1,High'
      const file = makeFile(csv, 'test.csv')

      const result = await importComposable.importFromFile(file, {
        format: 'csv',
        requiredFields: ['title']
      })

      expect(result.success).toBe(false)
      expect(result.errors[0]).toContain('title')
    })

    it('handles quoted fields with commas', async () => {
      const csv = 'title,description\n"Case, one","Has a comma, inside"\nCase 2,Normal'
      const file = makeFile(csv, 'test.csv')

      const result = await importComposable.importFromFile<Record<string, string>>(file, {
        format: 'csv'
      })

      expect(result.data[0].title).toBe('Case, one')
      expect(result.totalRows).toBe(2)
    })
  })
})
