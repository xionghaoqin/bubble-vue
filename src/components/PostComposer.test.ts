import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostComposer from '@/components/PostComposer.vue'

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(PostComposer, {
    props: { modelValue: '', maxLength: 280, error: null, ...props },
  })
}

describe('PostComposer', () => {
  it('渲染输入框、字数统计与发布按钮', () => {
    const wrapper = mountComposer()

    expect(wrapper.find('[data-testid="composer-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="composer-counter"]').text()).toBe('0/280')
    expect(wrapper.find('[data-testid="composer-submit"]').text()).toBe('发布')
  })

  it('输入时更新字数统计并向外同步内容', async () => {
    // 受控组件：模拟父组件用 v-model 接收更新，验证完整双向契约
    const wrapper = mount(PostComposer, {
      props: {
        modelValue: '',
        maxLength: 280,
        error: null,
        'onUpdate:modelValue': (value: string) => wrapper.setProps({ modelValue: value }),
      },
    })
    const input = wrapper.find('[data-testid="composer-input"]')

    await input.setValue('你好泡泡')

    expect(wrapper.find('[data-testid="composer-counter"]').text()).toBe('4/280')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['你好泡泡'])
  })

  it('点击发布时触发 submit 事件', async () => {
    const wrapper = mountComposer({ modelValue: '要发布的内容' })

    await wrapper.find('[data-testid="composer-submit"]').trigger('click')

    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('有错误信息时展示错误提示', () => {
    const wrapper = mountComposer({ error: '内容不能为空' })

    expect(wrapper.find('[data-testid="composer-error"]').text()).toBe('内容不能为空')
  })

  it('无错误信息时不展示错误提示', () => {
    const wrapper = mountComposer()

    expect(wrapper.find('[data-testid="composer-error"]').exists()).toBe(false)
  })

  it('接近字数上限时计数器进入警告状态', () => {
    const wrapper = mountComposer({ modelValue: 'a'.repeat(240) })

    expect(wrapper.find('[data-testid="composer-counter"]').classes()).toContain('is-warn')
  })

  it('超过字数上限时计数器进入超限状态', () => {
    const wrapper = mountComposer({ modelValue: 'a'.repeat(281) })

    expect(wrapper.find('[data-testid="composer-counter"]').classes()).toContain('is-over')
  })

  it('字数统计跟随 maxLength 属性计算', () => {
    const wrapper = mountComposer({ modelValue: 'abc', maxLength: 100 })

    expect(wrapper.find('[data-testid="composer-counter"]').text()).toBe('3/100')
  })
})
