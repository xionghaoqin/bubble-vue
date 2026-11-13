import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostList from '@/components/PostList.vue'
import type { Post, ReactionKind } from '@/types/post'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post',
    content: '内容',
    createdAt: 1,
    likeCount: 0,
    liked: false,
    favoriteCount: 0,
    favorited: false,
    ...overrides,
  }
}

const posts: Post[] = [
  makePost({ id: 'b', content: '第二条', createdAt: 2, likeCount: 1 }),
  makePost({ id: 'a', content: '第一条', createdAt: 1 }),
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

  it('透传点赞事件与 id', async () => {
    const wrapper = mount(PostList, { props: { posts } })

    await wrapper.findAll('[data-testid="post-like"]')[1]?.trigger('click')

    expect(wrapper.emitted('like')?.[0]).toEqual(['a'])
  })

  it('透传收藏事件与 id', async () => {
    const wrapper = mount(PostList, { props: { posts } })

    await wrapper.findAll('[data-testid="post-favorite"]')[0]?.trigger('click')

    expect(wrapper.emitted('favorite')?.[0]).toEqual(['b'])
  })

  it('按 isReacting 把进行中状态传给对应卡片', () => {
    const wrapper = mount(PostList, {
      props: {
        posts,
        isReacting: (id: string, kind: ReactionKind) => id === 'b' && kind === 'like',
      },
    })

    const likes = wrapper.findAll('[data-testid="post-like"]')
    const favorites = wrapper.findAll('[data-testid="post-favorite"]')

    expect(likes[0]?.attributes('disabled')).toBeDefined()
    expect(likes[1]?.attributes('disabled')).toBeUndefined()
    expect(favorites[0]?.attributes('disabled')).toBeUndefined()
  })

  it('未提供 isReacting 时按钮可点击', async () => {
    const wrapper = mount(PostList, { props: { posts } })

    expect(wrapper.findAll('[data-testid="post-like"]')[0]?.attributes('disabled')).toBeUndefined()

    await wrapper.findAll('[data-testid="post-like"]')[0]?.trigger('click')
    expect(wrapper.emitted('like')).toHaveLength(1)
  })
})
