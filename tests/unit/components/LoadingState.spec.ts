import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingState from '@/components/common/LoadingState.vue'

describe('LoadingState', () => {
  describe('spinner type', () => {
    it('should render spinner by default', () => {
      const wrapper = mount(LoadingState)

      expect(wrapper.findComponent({ name: 'ProgressSpinner' }).exists()).toBe(true)
    })

    it('should render with custom message', () => {
      const wrapper = mount(LoadingState, {
        props: { message: 'Loading data...' }
      })

      expect(wrapper.find('.loading-message').text()).toBe('Loading data...')
    })

    it('should not show message when not provided', () => {
      const wrapper = mount(LoadingState)

      expect(wrapper.find('.loading-message').exists()).toBe(false)
    })
  })

  describe('skeleton type', () => {
    it('should render skeleton lines', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'skeleton' }
      })

      expect(wrapper.find('.skeleton-container').exists()).toBe(true)
    })

    it('should render correct number of skeleton lines', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'skeleton', lines: 5 }
      })

      const skeletons = wrapper.findAllComponents({ name: 'Skeleton' })
      expect(skeletons).toHaveLength(5)
    })

    it('should render 3 lines by default', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'skeleton' }
      })

      const skeletons = wrapper.findAllComponents({ name: 'Skeleton' })
      expect(skeletons).toHaveLength(3)
    })
  })

  describe('dots type', () => {
    it('should render dots', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'dots' }
      })

      expect(wrapper.find('.dots-container').exists()).toBe(true)
    })

    it('should render 3 dots', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'dots' }
      })

      const dots = wrapper.findAll('.dot')
      expect(dots).toHaveLength(3)
    })

    it('should apply size class to dots container', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'dots', size: 'large' }
      })

      expect(wrapper.find('.dots-container').classes()).toContain('large')
    })

    it('should show message with dots', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'dots', message: 'Please wait...' }
      })

      expect(wrapper.find('.loading-message').text()).toBe('Please wait...')
    })
  })

  describe('size variations', () => {
    it('should apply small size to spinner', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'spinner', size: 'small' }
      })

      const spinner = wrapper.findComponent({ name: 'ProgressSpinner' })
      expect(spinner.attributes('style')).toContain('30px')
    })

    it('should apply medium size to spinner by default', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'spinner' }
      })

      const spinner = wrapper.findComponent({ name: 'ProgressSpinner' })
      expect(spinner.attributes('style')).toContain('45px')
    })

    it('should apply large size to spinner', () => {
      const wrapper = mount(LoadingState, {
        props: { type: 'spinner', size: 'large' }
      })

      const spinner = wrapper.findComponent({ name: 'ProgressSpinner' })
      expect(spinner.attributes('style')).toContain('60px')
    })
  })

  describe('fullHeight', () => {
    it('should not apply full-height class by default', () => {
      const wrapper = mount(LoadingState)

      expect(wrapper.find('.loading-state').classes()).not.toContain('full-height')
    })

    it('should apply full-height class when prop is true', () => {
      const wrapper = mount(LoadingState, {
        props: { fullHeight: true }
      })

      expect(wrapper.find('.loading-state').classes()).toContain('full-height')
    })
  })
})
