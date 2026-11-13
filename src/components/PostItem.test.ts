import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostItem from '@/components/PostItem.vue'
import type { Post } from '@/types/post'

const post: Post = { id: 'post-1', content: '一条测试内容', createdAt: Date.now() }

describe('PostItem', () => {
  it('展示内容与相对时间', () => {
    const wrapper = mount(PostItem, { props: { post } })

    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('一条测试内容')
    expect(wrapper.find('[data-testid="post-time"]').text()).toBe('刚刚')
  })

  it('点击删除按钮向父级抛出 id', async () => {
    const wrapper = mount(PostItem, { props: { post } })

    await wrapper.find('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.emitted('remove')?.[0]).toEqual(['post-1'])
  })

  it('用户输入按文本渲染，不产生 script 元素', () => {
    const dangerous: Post = {
      id: 'xss',
      content: '<script>alert(1)</script>',
      createdAt: Date.now(),
    }

    const wrapper = mount(PostItem, { props: { post: dangerous } })

    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('<script>alert(1)</script>')
    expect(wrapper.element.querySelector('script')).toBeNull()
  })

  it('根据 id 生成稳定的卡片色相', () => {
    const wrapper = mount(PostItem, { props: { post } })
    const style = wrapper.attributes('style') ?? ''

    expect(style).toContain('--hue')
  })
})
