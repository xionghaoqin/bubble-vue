import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostItem from '@/components/PostItem.vue'
import type { Post } from '@/types/post'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    content: '一条测试内容',
    createdAt: Date.now(),
    likeCount: 0,
    liked: false,
    favoriteCount: 0,
    favorited: false,
    ...overrides,
  }
}

const post = makePost()

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
    const dangerous = makePost({ id: 'xss', content: '<script>alert(1)</script>' })

    const wrapper = mount(PostItem, { props: { post: dangerous } })

    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('<script>alert(1)</script>')
    expect(wrapper.element.querySelector('script')).toBeNull()
  })

  it('根据 id 生成稳定的卡片色相', () => {
    const wrapper = mount(PostItem, { props: { post } })
    const style = wrapper.attributes('style') ?? ''

    expect(style).toContain('--hue')
  })

  it('未互动时计数为 0，aria 状态为未激活', () => {
    const wrapper = mount(PostItem, { props: { post } })

    const like = wrapper.get('[data-testid="post-like"]')
    const favorite = wrapper.get('[data-testid="post-favorite"]')

    expect(wrapper.get('[data-testid="post-like-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="post-favorite-count"]').text()).toBe('0')
    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.attributes('aria-label')).toBe('点赞')
    expect(favorite.attributes('aria-pressed')).toBe('false')
    expect(favorite.attributes('aria-label')).toBe('收藏')
  })

  it('已点赞与已收藏时计数、aria 状态与高亮同步', () => {
    const wrapper = mount(PostItem, {
      props: {
        post: makePost({ likeCount: 7, liked: true, favoriteCount: 3, favorited: true }),
      },
    })

    const like = wrapper.get('[data-testid="post-like"]')
    const favorite = wrapper.get('[data-testid="post-favorite"]')

    expect(wrapper.get('[data-testid="post-like-count"]').text()).toBe('7')
    expect(wrapper.get('[data-testid="post-favorite-count"]').text()).toBe('3')
    expect(like.classes()).toContain('is-active')
    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.attributes('aria-label')).toBe('取消点赞')
    expect(favorite.classes()).toContain('is-active')
    expect(favorite.attributes('aria-pressed')).toBe('true')
    expect(favorite.attributes('aria-label')).toBe('取消收藏')
  })

  it('只有点赞时收藏按钮保持未激活', () => {
    const wrapper = mount(PostItem, {
      props: { post: makePost({ likeCount: 1, liked: true }) },
    })

    expect(wrapper.get('[data-testid="post-favorite"]').classes()).not.toContain('is-active')
    expect(wrapper.get('[data-testid="post-favorite"]').attributes('aria-pressed')).toBe('false')
  })

  it('点击点赞 / 收藏按钮抛出 id，且不自行改动数字', async () => {
    const wrapper = mount(PostItem, { props: { post } })

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await wrapper.get('[data-testid="post-favorite"]').trigger('click')

    expect(wrapper.emitted('like')?.[0]).toEqual(['post-1'])
    expect(wrapper.emitted('favorite')?.[0]).toEqual(['post-1'])
    expect(wrapper.get('[data-testid="post-like-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('false')
  })

  it('请求进行中时按钮禁用并降低不透明度', () => {
    const wrapper = mount(PostItem, {
      props: { post, liking: true, favoriting: true },
    })

    const like = wrapper.get('[data-testid="post-like"]')
    const favorite = wrapper.get('[data-testid="post-favorite"]')

    expect(like.attributes('disabled')).toBeDefined()
    expect(favorite.attributes('disabled')).toBeDefined()
    expect(like.classes()).toContain('is-pending')
    expect(favorite.classes()).toContain('is-pending')
  })

  it('点击进行中的按钮不会重复抛出事件', async () => {
    const wrapper = mount(PostItem, { props: { post, liking: true } })

    await wrapper.get('[data-testid="post-like"]').trigger('click')

    expect(wrapper.emitted('like')).toBeUndefined()
  })
})
