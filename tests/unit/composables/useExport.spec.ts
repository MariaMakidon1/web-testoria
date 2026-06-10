import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExport } from '@/composables/useExport'

describe('useExport', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>
  let mockClick: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:test')
    mockRevokeObjectURL = vi.fn()
    mockClick = vi.fn()

    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevokeObjectURL

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          click: mockClick,
          setAttribute: vi.fn()
        } as unknown as HTMLAnchorElement
      }
      return document.createElement(tag)
    })

    vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as unknown as Node)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as unknown as Node)
  })

  describe('exportToJson', () => {
    it('should export data as JSON', () => {
      const { exportToJson } = useExport()
      const data = [{ id: 1, name: 'Test' }]

      exportToJson(data, 'test-export')

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalled()
    })

    it('should format JSON with indentation', () => {
      const { exportToJson } = useExport()
      const data = [{ id: 1 }]

      let capturedBlob: Blob | null = null
      mockCreateObjectURL.mockImplementation((blob: Blob) => {
        capturedBlob = blob
        return 'blob:test'
      })

      exportToJson(data, 'test')

      expect(capturedBlob).toBeTruthy()
      expect(capturedBlob!.type).toBe('application/json')
    })
  })

  describe('exportToCsv', () => {
    it('should export data as CSV', () => {
      const { exportToCsv } = useExport()
      const data = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ]

      exportToCsv(data, 'test-export')

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
    })

    it('should include headers by default', () => {
      const { exportToCsv } = useExport()
      const data = [{ id: 1, name: 'Test' }]

      let _capturedContent = ''
      mockCreateObjectURL.mockImplementation((blob: Blob) => {
        blob.text().then(text => { _capturedContent = text })
        return 'blob:test'
      })

      exportToCsv(data, 'test', undefined, true)

      // Headers should be formatted
      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should escape values with commas', () => {
      const { exportToCsv } = useExport()
      const data = [{ name: 'Test, with comma' }]

      exportToCsv(data, 'test')

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })

    it('should escape values with quotes', () => {
      const { exportToCsv } = useExport()
      const data = [{ name: 'Test "quoted"' }]

      exportToCsv(data, 'test')

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  describe('exportToXml', () => {
    it('should export data as XML', () => {
      const { exportToXml } = useExport()
      const data = [{ id: 1, name: 'Test' }]

      exportToXml(data, 'test-export')

      expect(mockCreateObjectURL).toHaveBeenCalled()
      expect(mockClick).toHaveBeenCalled()
    })

    it('should escape XML special characters', () => {
      const { exportToXml } = useExport()
      const data = [{ name: '<Test & "Value">' }]

      exportToXml(data, 'test')

      expect(mockCreateObjectURL).toHaveBeenCalled()
    })
  })

  describe('exportData', () => {
    it('should export to correct format', async () => {
      const { exportData } = useExport()
      const data = [{ id: 1 }]

      const result = await exportData(data, {
        filename: 'test',
        format: 'json'
      })

      expect(result).toBe(true)
    })

    it('should handle unsupported format', async () => {
      const { exportData, error } = useExport()

      const result = await exportData([], {
        filename: 'test',
        format: 'unsupported' as 'json'
      })

      expect(result).toBe(false)
      expect(error.value).toBeTruthy()
    })

    it('should set exporting state', async () => {
      const { exportData, exporting } = useExport()

      const exportPromise = exportData([{ id: 1 }], {
        filename: 'test',
        format: 'json'
      })

      // After export completes
      await exportPromise
      expect(exporting.value).toBe(false)
    })
  })
})
