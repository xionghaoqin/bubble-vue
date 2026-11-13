import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostList from '@/components/PostList.vue'
import type { Post } from '@/types/post'

const posts: Post[] = [
  { id: 'b', content: '第二条', createdAt: 2 },
  { id: 'a', content: '第一条', createdAt: 1 },
]

describe('PostList', () => {
  it('为空时展示空状态提示', () => {
    const wrapper = mount(PostList, { props: { posts: [] } })

    expect(wrapper.find('[data-testid="feed-empty"]').text()).toContain('还没有内容')
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('有内容时按传入顺序渲染卡片并隐藏空状态', () => {
    const wrapper = mount(PostList, { props: { posts } })

    const items = wrapper.findAll('[data-testid="post-item"]')
    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('第二条')
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(false)
  })

  it('透传子组件的删除事件', async () => {
    const wrapper = mount(PostList, { props: { posts } })

    await wrapper.findAll('[data-testid="post-delete"]')[0]?.trigger('click')

    expect(wrapper.emitted('remove')?.[0]).toEqual(['b'])
  })
})
