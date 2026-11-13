import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePostsStore } from '@/stores/posts'
import { MAX_CONTENT_LENGTH, STORAGE_KEY, type Post } from '@/types/post'

function seed(posts: Post[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
}

function readStorage(): Post[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Post[]
}

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('本地无数据时列表为空', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.total).toBe(0)
    expect(store.isEmpty).toBe(true)
  })

  it('初始化时从 localStorage 读取已有内容', () => {
    seed([
      { id: 'a', content: '早一点的内容', createdAt: 1 },
      { id: 'b', content: '晚一点的内容', createdAt: 2 },
    ])

    const store = usePostsStore()

    expect(store.total).toBe(2)
    expect(store.isEmpty).toBe(false)
  })

  it('发布内容后写入状态并持久化', () => {
    const store = usePostsStore()

    const result = store.addPost('第一条泡泡')

    expect(result.ok).toBe(true)
    expect(store.total).toBe(1)
    expect(store.posts[0]?.content).toBe('第一条泡泡')
    expect(readStorage()).toHaveLength(1)
    expect(readStorage()[0]?.content).toBe('第一条泡泡')
  })

  it('发布时去除首尾空白', () => {
    const store = usePostsStore()

    store.addPost('  留有空白  ')

    expect(store.posts[0]?.content).toBe('留有空白')
  })

  it('空白内容被拒绝且不写入存储', () => {
    const store = usePostsStore()

    const result = store.addPost('   \n\t ')

    expect(result).toMatchObject({ ok: false, reason: 'empty' })
    expect(store.total).toBe(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('超过长度上限的内容被拒绝', () => {
    const store = usePostsStore()

    const result = store.addPost('a'.repeat(MAX_CONTENT_LENGTH + 1))

    expect(result).toMatchObject({ ok: false, reason: 'too-long' })
    expect(store.total).toBe(0)
  })

  it('刚好达到长度上限的内容可以发布', () => {
    const store = usePostsStore()

    const result = store.addPost('a'.repeat(MAX_CONTENT_LENGTH))

    expect(result.ok).toBe(true)
    expect(store.total).toBe(1)
  })

  it('sortedPosts 按创建时间倒序排列', () => {
    seed([
      { id: 'old', content: '旧', createdAt: 100 },
      { id: 'new', content: '新', createdAt: 300 },
      { id: 'mid', content: '中', createdAt: 200 },
    ])

    const store = usePostsStore()

    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
    // 不改变原始顺序，保证状态可预测
    expect(store.posts.map((post) => post.id)).toEqual(['old', 'new', 'mid'])
  })

  it('removePost 删除指定内容并写回存储', () => {
    seed([
      { id: 'a', content: '保留', createdAt: 1 },
      { id: 'b', content: '删除', createdAt: 2 },
    ])
    const store = usePostsStore()

    store.removePost('b')

    expect(store.posts.map((post) => post.id)).toEqual(['a'])
    expect(readStorage().map((post) => post.id)).toEqual(['a'])
  })

  it('删除不存在的 id 时保持原状', () => {
    seed([{ id: 'a', content: '保留', createdAt: 1 }])
    const store = usePostsStore()

    store.removePost('missing')

    expect(store.total).toBe(1)
  })

  it('存储内容损坏时兜底为空列表', () => {
    localStorage.setItem(STORAGE_KEY, '{ not-json')

    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.isEmpty).toBe(true)
  })

  it('存储内容不是数组时兜底为空列表', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ content: 'x' }))

    const store = usePostsStore()

    expect(store.posts).toEqual([])
  })

  it('写入失败时不抛异常，内存状态仍然更新', () => {
    const store = usePostsStore()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => store.addPost('写入会失败')).not.toThrow()
    expect(store.total).toBe(1)
  })

  it('reload 会重新从 localStorage 同步数据', () => {
    const store = usePostsStore()
    expect(store.total).toBe(0)

    seed([{ id: 'x', content: '外部写入', createdAt: 5 }])
    store.reload()

    expect(store.total).toBe(1)
    expect(store.posts[0]?.content).toBe('外部写入')
  })
})
