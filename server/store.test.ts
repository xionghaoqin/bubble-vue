// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../shared/post'
import { createPostStore } from './store'

/** 三条时间递增的种子数据，用来验证倒序 */
function seedPosts(): Post[] {
  return [
    { id: 'a', content: '最早的一条', createdAt: 1 },
    { id: 'b', content: '中间的一条', createdAt: 2 },
    { id: 'c', content: '最新的一条', createdAt: 3 },
  ]
}

describe('createPostStore', () => {
  it('未传种子数据时是空仓库', () => {
    const store = createPostStore()

    expect(store.list()).toEqual([])
    expect(store.size()).toBe(0)
  })

  it('create 生成完整实体并去除首尾空白', () => {
    const store = createPostStore()
    const before = Date.now()

    const post = store.create('  第一条泡泡  ')

    expect(post.content).toBe('第一条泡泡')
    expect(typeof post.id).toBe('string')
    expect(post.id.length).toBeGreaterThan(0)
    expect(post.createdAt).toBeGreaterThanOrEqual(before)
    expect(post.createdAt).toBeLessThanOrEqual(Date.now())
    expect(store.size()).toBe(1)
    expect(store.get(post.id)).toEqual(post)
  })

  it('create 两次得到不同 id', () => {
    const store = createPostStore()

    expect(store.create('a').id).not.toBe(store.create('b').id)
  })

  it('list 按 createdAt 倒序返回（新的在前）', () => {
    const store = createPostStore(seedPosts())

    expect(store.list().map((post) => post.id)).toEqual(['c', 'b', 'a'])
  })

  it('list 返回副本：改数组或改对象都不影响内部数据', () => {
    const store = createPostStore(seedPosts())

    const snapshot = store.list()
    snapshot.pop()
    snapshot[0].content = '被外部篡改'

    expect(store.list()).toHaveLength(3)
    expect(store.get('c')?.content).toBe('最新的一条')
  })

  it('get 命中返回实体，未命中返回 undefined', () => {
    const store = createPostStore(seedPosts())

    expect(store.get('b')).toEqual({ id: 'b', content: '中间的一条', createdAt: 2 })
    expect(store.get('missing')).toBeUndefined()
  })

  it('remove 成功返回 true 并同步更新 list 与 size', () => {
    const store = createPostStore(seedPosts())

    expect(store.remove('b')).toBe(true)
    expect(store.size()).toBe(2)
    expect(store.list().map((post) => post.id)).toEqual(['c', 'a'])
    expect(store.get('b')).toBeUndefined()
  })

  it('remove 不存在返回 false 且不影响数据', () => {
    const store = createPostStore(seedPosts())

    expect(store.remove('missing')).toBe(false)
    expect(store.size()).toBe(3)
  })

  it('clear 清空全部数据', () => {
    const store = createPostStore(seedPosts())

    store.clear()

    expect(store.list()).toEqual([])
    expect(store.size()).toBe(0)
    expect(store.get('a')).toBeUndefined()
  })

  it('种子数组被复制，外部再改动不会影响仓库', () => {
    const seeds = seedPosts()
    const store = createPostStore(seeds)

    seeds.push({ id: 'd', content: '外部新增', createdAt: 4 })
    seeds[0].content = '被外部篡改'

    expect(store.size()).toBe(3)
    expect(store.get('a')?.content).toBe('最早的一条')
  })

  it('不同实例之间互不影响', () => {
    const first = createPostStore()
    const second = createPostStore()

    first.create('只属于第一个仓库')

    expect(first.size()).toBe(1)
    expect(second.size()).toBe(0)
    expect(second.list()).toEqual([])
  })
})
