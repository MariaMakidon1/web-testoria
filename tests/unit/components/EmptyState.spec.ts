import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '@/components/common/EmptyState.vue'

describe('EmptyState', () => {
  describe('rendering', () => {
    it('should render with default props', () => {
      const wrapper = mount(EmptyState)

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.text()).toContain('No data found')
    })

    it('should render custom title', () => {
      const wrapper = mount(EmptyState, {
        props: { title: 'Custom Title' }
      })

      expect(wrapper.find('.empty-title').text()).toBe('Custom Title')
    })

    it('should render custom message', () => {
      const wrapper = mount(EmptyState, {
        props: { message: 'Custom message here' }
      })

      expect(wrapper.find('.empty-message').text()).toBe('Custom message here')
    })

    it('should render custom icon', () => {
      const wrapper = mount(EmptyState, {
        props: { icon: 'pi pi-folder' }
      })

      expect(wrapper.find('.empty-icon').classes()).toContain('pi-folder')
    })
  })

  describe('compact mode', () => {
    it('should apply compact class when compact prop is true', () => {
      const wrapper = mount(EmptyState, {
        props: { compact: true }
      })

      expect(wrapper.find('.empty-state').classes()).toContain('compact')
    })

    it('should not apply compact class by default', () => {
      const wrapper = mount(EmptyState)

      expect(wrapper.find('.empty-state').classes()).not.toContain('compact')
    })
  })

  describe('action button', () => {
    it('should not render button when actionLabel is not provided', () => {
      const wrapper = mount(EmptyState)

      expect(wrapper.findComponent({ name: 'Button' }).exists()).toBe(false)
    })

    it('should render button when actionLabel is provided', () => {
      const wrapper = mount(EmptyState, {
        props: { actionLabel: 'Create New' }
      })

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.exists()).toBe(true)
      expect(button.props('label')).toBe('Create New')
    })

    it('should render button with icon', () => {
      const wrapper = mount(EmptyState, {
        props: {
          actionLabel: 'Add Item',
          actionIcon: 'pi pi-plus'
        }
      })

      const button = wrapper.findComponent({ name: 'Button' })
      expect(button.props('icon')).toBe('pi pi-plus')
    })

    it('should emit action event when button clicked', async () => {
      const wrapper = mount(EmptyState, {
        props: { actionLabel: 'Click Me' }
      })

      await wrapper.findComponent({ name: 'Button' }).trigger('click')

      expect(wrapper.emitted('action')).toHaveLength(1)
    })
  })

  describe('slots', () => {
    it('should render actions slot', () => {
      const wrapper = mount(EmptyState, {
        slots: {
          actions: '<button class="custom-action">Custom Action</button>'
        }
      })

      expect(wrapper.find('.custom-action').exists()).toBe(true)
    })
  })
})
