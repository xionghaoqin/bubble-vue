// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../shared/post'
import { createPostStore } from './store'

/** 三条时间递增的种子数据，用来验证倒序 */
function seedPosts(): Post[] {
  return [
    {
      id: 'a',
      content: '最早的一条',
      createdAt: 1,
      likeCount: 0,
      liked: false,
      favoriteCount: 0,
      favorited: false,
    },
    {
      id: 'b',
      content: '中间的一条',
      createdAt: 2,
      likeCount: 0,
      liked: false,
      favoriteCount: 0,
      favorited: false,
    },
    {
      id: 'c',
      content: '最新的一条',
      createdAt: 3,
      likeCount: 0,
      liked: false,
      favoriteCount: 0,
      favorited: false,
    },
  ]
}

/** 模拟契约升级前的旧种子：缺少互动字段，用来验证运行时兜底归一化 */
function legacySeedPosts(): Post[] {
  return [
    { id: 'legacy', content: '旧数据', createdAt: 9 },
    { id: 'partial', content: '部分字段缺失', createdAt: 10, likeCount: 2, liked: false },
  ] as unknown as Post[]
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

  it('create 默认互动字段为未点赞未收藏', () => {
    const store = createPostStore()

    const post = store.create('带默认互动状态')

    expect(post.likeCount).toBe(0)
    expect(post.liked).toBe(false)
    expect(post.favoriteCount).toBe(0)
    expect(post.favorited).toBe(false)
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

    expect(store.get('b')).toEqual({
      id: 'b',
      content: '中间的一条',
      createdAt: 2,
      likeCount: 0,
      liked: false,
      favoriteCount: 0,
      favorited: false,
    })
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

    seeds.push({
      id: 'd',
      content: '外部新增',
      createdAt: 4,
      likeCount: 0,
      liked: false,
      favoriteCount: 0,
      favorited: false,
    })
    seeds[0].content = '被外部篡改'
    seeds[0].liked = true

    expect(store.size()).toBe(3)
    expect(store.get('a')?.content).toBe('最早的一条')
    expect(store.get('a')?.liked).toBe(false)
  })

  it('旧种子缺少互动字段时按默认值归一化，不会出现 undefined', () => {
    const store = createPostStore(legacySeedPosts())

    const legacy = store.get('legacy')
    const partial = store.get('partial')

    expect(legacy).toEqual({
      id: 'legacy',
      content: '旧数据',
      createdAt: 9,
      likeCount: 0,
      liked: false,
      favoriteCount: 0,
      favorited: false,
    })
    // 已有字段保留，缺失字段补默认
    expect(partial?.likeCount).toBe(2)
    expect(partial?.liked).toBe(false)
    expect(partial?.favoriteCount).toBe(0)
    expect(partial?.favorited).toBe(false)
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

describe('点赞', () => {
  it('like 置为已赞并递增计数，返回更新后的副本', () => {
    const store = createPostStore(seedPosts())

    const updated = store.like('a')

    expect(updated?.liked).toBe(true)
    expect(updated?.likeCount).toBe(1)
    expect(store.get('a')?.liked).toBe(true)
    expect(store.get('a')?.likeCount).toBe(1)
  })

  it('重复 like 幂等，计数不会重复累加', () => {
    const store = createPostStore(seedPosts())

    store.like('a')
    const second = store.like('a')

    expect(second?.liked).toBe(true)
    expect(second?.likeCount).toBe(1)
    expect(store.get('a')?.likeCount).toBe(1)
  })

  it('unlike 置为未赞并回落计数', () => {
    const store = createPostStore(seedPosts())
    store.like('a')

    const updated = store.unlike('a')

    expect(updated?.liked).toBe(false)
    expect(updated?.likeCount).toBe(0)
    expect(store.get('a')?.liked).toBe(false)
  })

  it('未点赞时 unlike 幂等，计数不为负', () => {
    const store = createPostStore(seedPosts())

    const updated = store.unlike('a')

    expect(updated?.liked).toBe(false)
    expect(updated?.likeCount).toBe(0)
  })

  it('id 不存在时 like / unlike 均返回 undefined', () => {
    const store = createPostStore(seedPosts())

    expect(store.like('missing')).toBeUndefined()
    expect(store.unlike('missing')).toBeUndefined()
    expect(store.size()).toBe(3)
  })

  it('互动结果对外是副本，改返回值不影响仓库', () => {
    const store = createPostStore(seedPosts())

    const updated = store.like('a')
    updated!.likeCount = 99
    updated!.liked = false

    expect(store.get('a')?.likeCount).toBe(1)
    expect(store.get('a')?.liked).toBe(true)
  })
})

describe('收藏', () => {
  it('favorite 置为已收藏并递增计数', () => {
    const store = createPostStore(seedPosts())

    const updated = store.favorite('b')

    expect(updated?.favorited).toBe(true)
    expect(updated?.favoriteCount).toBe(1)
    expect(store.get('b')?.favorited).toBe(true)
  })

  it('重复 favorite 幂等', () => {
    const store = createPostStore(seedPosts())

    store.favorite('b')
    const second = store.favorite('b')

    expect(second?.favoriteCount).toBe(1)
  })

  it('unfavorite 取消收藏并回落计数，未收藏时幂等', () => {
    const store = createPostStore(seedPosts())

    expect(store.unfavorite('b')?.favoriteCount).toBe(0)

    store.favorite('b')
    const updated = store.unfavorite('b')

    expect(updated?.favorited).toBe(false)
    expect(updated?.favoriteCount).toBe(0)
  })

  it('id 不存在时 favorite / unfavorite 均返回 undefined', () => {
    const store = createPostStore(seedPosts())

    expect(store.favorite('missing')).toBeUndefined()
    expect(store.unfavorite('missing')).toBeUndefined()
  })
})

describe('点赞与收藏互不影响', () => {
  it('点赞不改收藏状态，反之亦然', () => {
    const store = createPostStore(seedPosts())

    const liked = store.like('c')
    expect(liked?.favoriteCount).toBe(0)
    expect(liked?.favorited).toBe(false)

    const favorited = store.favorite('c')
    expect(favorited?.likeCount).toBe(1)
    expect(favorited?.liked).toBe(true)

    const unliked = store.unlike('c')
    expect(unliked?.favoriteCount).toBe(1)
    expect(unliked?.favorited).toBe(true)
  })
})
