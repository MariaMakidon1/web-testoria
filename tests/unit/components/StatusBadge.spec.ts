import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatusBadge from '@/components/common/StatusBadge.vue'

describe('StatusBadge', () => {
  describe('rendering', () => {
    it('should render with value', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'passed' }
      })

      expect(wrapper.text()).toContain('passed')
    })

    it('should apply size class', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'Test', size: 'small' }
      })

      expect(wrapper.find('.badge-small').exists()).toBe(true)
    })

    it('should apply large size class', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'Test', size: 'large' }
      })

      expect(wrapper.find('.badge-large').exists()).toBe(true)
    })
  })

  describe('result type badges', () => {
    // Result-type badges render via inline customStyle (plan-087 / TES-78).
    // Style assertions read from the rendered DOM rather than props because
    // PrimeVue's <Tag> doesn't expose `style` as a prop — the binding flows
    // straight to the rendered element.
    function styleOf(value: string): string {
      const wrapper = mount(StatusBadge, {
        props: { value, type: 'result' as const }
      })
      return wrapper.find('.status-badge').attributes('style') ?? ''
    }

    it('renders passed with green background and dark green text', () => {
      const style = styleOf('passed')
      expect(style).toContain('background-color: #dcfce7')
      expect(style).toContain('color: #166534')
    })

    it('renders failed with red background and dark red text', () => {
      const style = styleOf('failed')
      expect(style).toContain('background-color: #fee2e2')
      expect(style).toContain('color: #991b1b')
    })

    it('renders blocked with slate-gray background and white text (TES-78)', () => {
      const style = styleOf('blocked')
      expect(style).toContain('background-color: #4b5563')
      expect(style).toContain('color: #ffffff')
    })

    it('renders no_run with light-gray background and dark text', () => {
      const style = styleOf('no_run')
      expect(style).toContain('background-color: #f3f4f6')
      expect(style).toContain('color: #374151')
    })

    it('blocked and passed have visibly different backgrounds (regression guard for TES-78)', () => {
      expect(styleOf('blocked')).not.toBe(styleOf('passed'))
      // Stronger: pull just background-color from each and compare
      const blockedBg = /background-color:\s*([^;]+)/.exec(styleOf('blocked'))?.[1].trim()
      const passedBg = /background-color:\s*([^;]+)/.exec(styleOf('passed'))?.[1].trim()
      expect(blockedBg).toBeTruthy()
      expect(passedBg).toBeTruthy()
      expect(blockedBg).not.toEqual(passedBg)
    })

    it('passes a non-empty icon prop for every result status', () => {
      for (const value of ['passed', 'failed', 'blocked', 'no_run']) {
        const wrapper = mount(StatusBadge, {
          props: { value, type: 'result' as const }
        })
        const tag = wrapper.findComponent({ name: 'Tag' })
        expect(tag.props('icon')).toMatch(/^pi pi-/)
      }
    })
  })

  describe('priority type badges', () => {
    it('should show danger severity for critical', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'critical', type: 'priority' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('severity')).toBe('danger')
    })

    it('should show warning severity for high', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'high', type: 'priority' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('severity')).toBe('warning')
    })

    it('should show success severity for low', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'low', type: 'priority' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('severity')).toBe('success')
    })
  })

  describe('run type badges', () => {
    it('should show warning severity for active', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'active', type: 'run' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('severity')).toBe('warning')
    })

    it('should show success severity for completed', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'completed', type: 'run' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('severity')).toBe('success')
    })
  })

  describe('custom styling', () => {
    it('should apply custom icon', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'Custom', icon: 'pi pi-star' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('icon')).toBe('pi pi-star')
    })

    it('should apply custom colors', () => {
      const wrapper = mount(StatusBadge, {
        props: {
          value: 'Custom',
          customColor: '#fff',
          customBackground: '#000'
        }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.attributes('style')).toContain('color')
    })
  })

  describe('unknown values', () => {
    it('should use secondary severity for unknown result', () => {
      const wrapper = mount(StatusBadge, {
        props: { value: 'Unknown', type: 'result' }
      })

      const tag = wrapper.findComponent({ name: 'Tag' })
      expect(tag.props('severity')).toBe('secondary')
    })
  })
})
