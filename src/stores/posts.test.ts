import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePostsStore } from '@/stores/posts'
import { MAX_CONTENT_LENGTH, type Post, type ReactionKind } from '@/types/post'

// --- 内存假后端：把 fetch 换成受控实现，断言只看「请求 + 状态变化」 ---

interface RecordedCall {
  url: string
  method: string
  body?: string
}

/** 允许测试只写业务关心的字段，互动计数字段统一补默认值 */
type PostFixture = Pick<Post, 'id' | 'content' | 'createdAt'> & Partial<Post>

function definePost(fixture: PostFixture): Post {
  return { likeCount: 0, liked: false, favoriteCount: 0, favorited: false, ...fixture }
}

/** 与服务端语义一致：计数只在状态真正翻转时增减 */
function withReaction(post: Post, kind: ReactionKind, active: boolean): Post {
  if (kind === 'like') {
    if (post.liked === active) return post
    return { ...post, liked: active, likeCount: Math.max(0, post.likeCount + (active ? 1 : -1)) }
  }
  if (post.favorited === active) return post
  return {
    ...post,
    favorited: active,
    favoriteCount: Math.max(0, post.favoriteCount + (active ? 1 : -1)),
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

function unparsableResponse(status = 500): Response {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON')
    },
  } as unknown as Response
}

function noContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    json: async () => {
      throw new SyntaxError('204 没有响应体')
    },
  } as unknown as Response
}

function createFetchMock(initialPosts: PostFixture[] = []) {
  const db = new Map(initialPosts.map((fixture) => [fixture.id, definePost(fixture)]))
  const calls: RecordedCall[] = []
  let nextId = 1

  const state = {
    /** 非空时 GET 列表会挂起，直到测试手动 resolve */
    holdList: null as Promise<void> | null,
    /** 非空时点赞/收藏请求会挂起，用于验证进行中状态与并发去重 */
    holdReaction: null as Promise<void> | null,
    /** true 时所有请求立即 reject，模拟断网 */
    offline: false,
    failures: {
      list: null as Response | null,
      create: null as Response | null,
      remove: null as Response | null,
      reaction: null as Response | null,
    },
  }

  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined })

    if (state.offline) throw new TypeError('Failed to fetch')

    if (method === 'GET' && url === '/api/posts') {
      if (state.holdList) await state.holdList
      if (state.failures.list) return state.failures.list
      return jsonResponse({ posts: [...db.values()] })
    }

    if (method === 'POST' && url === '/api/posts') {
      if (state.failures.create) return state.failures.create
      const payload = JSON.parse(String(init?.body ?? '{}')) as { content?: string }
      const content = String(payload.content ?? '').trim()
      if (!content) {
        return jsonResponse({ error: { code: 'empty', message: '内容不能为空' } }, 400)
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        return jsonResponse(
          { error: { code: 'too-long', message: `内容不能超过 ${MAX_CONTENT_LENGTH} 字` } },
          400
        )
      }
      const post = definePost({ id: `srv-${nextId}`, content, createdAt: 1_000_000 + nextId })
      nextId += 1
      db.set(post.id, post)
      return jsonResponse({ post }, 201)
    }

    const reactionMatch = /^\/api\/posts\/([^/]+)\/(like|favorite)$/.exec(url)
    if (reactionMatch && (method === 'POST' || method === 'DELETE')) {
      if (state.holdReaction) await state.holdReaction
      if (state.failures.reaction) return state.failures.reaction
      const id = decodeURIComponent(reactionMatch[1] as string)
      const kind = reactionMatch[2] as ReactionKind
      const current = db.get(id)
      if (!current) {
        return jsonResponse({ error: { code: 'not-found', message: '内容不存在' } }, 404)
      }
      const post = withReaction(current, kind, method === 'POST')
      db.set(post.id, post)
      return jsonResponse({ post })
    }

    const deleteMatch = /^\/api\/posts\/([^/]+)$/.exec(url)
    if (method === 'DELETE' && deleteMatch) {
      if (state.failures.remove) return state.failures.remove
      const id = decodeURIComponent(deleteMatch[1] as string)
      if (!db.has(id)) {
        return jsonResponse({ error: { code: 'not-found', message: '内容不存在' } }, 404)
      }
      db.delete(id)
      return noContentResponse()
    }

    return jsonResponse(
      { error: { code: 'method-not-allowed', message: `unexpected ${method} ${url}` } },
      405
    )
  })

  return { fetchMock, db, calls, state }
}

/** 每个用例独立：新 pinia + 新假后端 */
function setup(initialPosts: PostFixture[] = []) {
  const api = createFetchMock(initialPosts)
  vi.stubGlobal('fetch', api.fetchMock)
  const store = usePostsStore()
  return { api, store }
}

function reactionCalls(api: ReturnType<typeof createFetchMock>): RecordedCall[] {
  return api.calls.filter((call) => /\/(like|favorite)$/.test(call.url))
}

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态为空列表、未加载、无错误', () => {
    const { store } = setup()

    expect(store.posts).toEqual([])
    expect(store.total).toBe(0)
    expect(store.isEmpty).toBe(true)
    expect(store.loading).toBe(false)
    expect(store.error).toBeNull()
    expect(store.isReacting('any', 'like')).toBe(false)
    // 构造 store 不应该自动请求，加载由调用方（页面 onMounted）控制
    expect(fetch).not.toHaveBeenCalled()
  })

  it('load 通过 GET /api/posts 拉取列表写入状态', async () => {
    const { api, store } = setup([{ id: 'old', content: '旧内容', createdAt: 100 }])

    await store.load()

    expect(api.calls).toHaveLength(1)
    expect(api.calls[0]).toMatchObject({ url: '/api/posts', method: 'GET' })
    expect(store.posts.map((post) => post.id)).toEqual(['old'])
    expect(store.total).toBe(1)
    expect(store.isEmpty).toBe(false)
    expect(store.error).toBeNull()
  })

  it('load 成功后 sortedPosts 按 createdAt 倒序，且不改变 posts 原始顺序', async () => {
    const { store } = setup([
      { id: 'old', content: '旧', createdAt: 100 },
      { id: 'new', content: '新', createdAt: 300 },
      { id: 'mid', content: '中', createdAt: 200 },
    ])

    await store.load()

    expect(store.sortedPosts.map((post) => post.id)).toEqual(['new', 'mid', 'old'])
    expect(store.posts.map((post) => post.id)).toEqual(['old', 'new', 'mid'])
  })

  it('load 进行中 loading 为 true，结束后复位', async () => {
    const { api, store } = setup()
    let release!: () => void
    api.state.holdList = new Promise<void>((resolve) => {
      release = resolve
    })

    const pending = store.load()
    expect(store.loading).toBe(true)

    release()
    await pending

    expect(store.loading).toBe(false)
  })

  it('load 失败时保留已有列表并设置可展示错误，不抛异常', async () => {
    const { api, store } = setup([{ id: 'a', content: '已有内容', createdAt: 1 }])
    await store.load()

    api.state.failures.list = unparsableResponse(500)
    await expect(store.load()).resolves.toBeUndefined()

    expect(store.posts.map((post) => post.id)).toEqual(['a'])
    expect(store.error).toBeTruthy()
    expect(store.loading).toBe(false)
  })

  it('初次 load 遇到网络异常时列表为空、暴露错误且页面不崩', async () => {
    const { api, store } = setup()
    api.state.offline = true

    await expect(store.load()).resolves.toBeUndefined()

    expect(store.posts).toEqual([])
    expect(store.isEmpty).toBe(true)
    expect(store.error).toBe('加载失败，请稍后重试')
  })

  it('addPost 成功时调用 POST 并采用服务端返回实体更新列表', async () => {
    const { api, store } = setup()

    const result = await store.addPost('  第一条泡泡  ')

    expect(api.calls).toHaveLength(1)
    expect(api.calls[0]).toMatchObject({ url: '/api/posts', method: 'POST' })
    expect(JSON.parse(api.calls[0]?.body ?? '{}')).toEqual({ content: '第一条泡泡' })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.post).toMatchObject({ id: 'srv-1', content: '第一条泡泡' })
    expect(store.posts).toEqual([result.post])
    expect(store.total).toBe(1)
    expect(store.error).toBeNull()
  })

  it('空白内容被本地拦截，不发起请求也不写入 error', async () => {
    const { api, store } = setup()

    const result = await store.addPost('   \n\t ')

    expect(result).toEqual({ ok: false, reason: 'empty', message: '内容不能为空' })
    expect(api.fetchMock).not.toHaveBeenCalled()
    expect(store.total).toBe(0)
    expect(store.error).toBeNull()
  })

  it('超过上限的内容被本地拦截，不发起请求', async () => {
    const { store } = setup()

    const result = await store.addPost('a'.repeat(MAX_CONTENT_LENGTH + 1))

    expect(result).toEqual({
      ok: false,
      reason: 'too-long',
      message: `内容不能超过 ${MAX_CONTENT_LENGTH} 字`,
    })
    expect(fetch).not.toHaveBeenCalled()
    expect(store.total).toBe(0)
  })

  it('刚好达到上限的内容可以发布', async () => {
    const { store } = setup()

    const result = await store.addPost('a'.repeat(MAX_CONTENT_LENGTH))

    expect(result.ok).toBe(true)
    expect(store.total).toBe(1)
  })

  it('服务端 400 时返回对应失败原因并设置 error，列表不变', async () => {
    const { api, store } = setup()
    api.state.failures.create = jsonResponse(
      { error: { code: 'too-long', message: '服务端认为内容太长' } },
      400
    )

    const result = await store.addPost('看起来正常的内容')

    expect(result).toEqual({ ok: false, reason: 'too-long', message: '服务端认为内容太长' })
    expect(store.error).toBe('服务端认为内容太长')
    expect(store.posts).toEqual([])
  })

  it('发布遇到网络异常时返回 network 失败且不抛异常', async () => {
    const { api, store } = setup()
    api.state.offline = true

    const result = await store.addPost('内容')

    expect(result).toEqual({ ok: false, reason: 'network', message: '发布失败，请稍后重试' })
    expect(store.error).toBe('发布失败，请稍后重试')
    expect(store.posts).toEqual([])
  })

  it('发布遇到无法解析的错误响应时退化为通用文案', async () => {
    const { api, store } = setup()
    api.state.failures.create = unparsableResponse(500)

    const result = await store.addPost('内容')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.reason).toBe('network')
    expect(result.message).toBeTruthy()
    expect(store.error).toBe(result.message)
    expect(store.posts).toEqual([])
  })

  it('成功后清除上一次失败留下的 error', async () => {
    const { api, store } = setup()
    api.state.failures.create = jsonResponse(
      { error: { code: 'internal', message: '服务器开小差了' } },
      500
    )
    await store.addPost('第一次')
    expect(store.error).toBe('服务器开小差了')

    api.state.failures.create = null
    const result = await store.addPost('第二次')

    expect(result.ok).toBe(true)
    expect(store.error).toBeNull()
    expect(store.total).toBe(1)
  })

  it('removePost 成功时调用 DELETE 并从列表移除', async () => {
    const { api, store } = setup([
      { id: 'a', content: '保留', createdAt: 1 },
      { id: 'b', content: '删除', createdAt: 2 },
    ])
    await store.load()

    const removed = await store.removePost('b')

    expect(removed).toBe(true)
    expect(api.calls.at(-1)).toMatchObject({ url: '/api/posts/b', method: 'DELETE' })
    expect(store.posts.map((post) => post.id)).toEqual(['a'])
  })

  it('removePost 遇到 404 时返回 false 且列表保持原样', async () => {
    const { api, store } = setup([{ id: 'a', content: '保留', createdAt: 1 }])
    await store.load()
    api.state.failures.remove = jsonResponse(
      { error: { code: 'not-found', message: '内容不存在' } },
      404
    )

    const removed = await store.removePost('a')

    expect(removed).toBe(false)
    expect(store.posts.map((post) => post.id)).toEqual(['a'])
    expect(store.error).toBe('内容不存在')
  })

  it('removePost 遇到网络异常时返回 false 且不抛异常', async () => {
    const { api, store } = setup([{ id: 'a', content: '保留', createdAt: 1 }])
    await store.load()
    api.state.offline = true

    await expect(store.removePost('a')).resolves.toBe(false)

    expect(store.posts.map((post) => post.id)).toEqual(['a'])
    expect(store.error).toBe('删除失败，请稍后重试')
  })

  it('reload 等价于重新拉取服务端数据', async () => {
    const { api, store } = setup()
    expect(store.total).toBe(0)

    api.db.set('x', definePost({ id: 'x', content: '外部写入', createdAt: 5 }))
    await store.reload()

    expect(store.total).toBe(1)
    expect(store.posts[0]?.content).toBe('外部写入')
    expect(api.calls).toHaveLength(1)
  })

  // --- 点赞 ---

  it('setLiked(true) 调用 POST /like 并用服务端实体替换列表项', async () => {
    const { api, store } = setup([
      { id: 'a', content: '第一条', createdAt: 2 },
      { id: 'b', content: '第二条', createdAt: 1 },
    ])
    await store.load()

    const ok = await store.setLiked('a', true)

    expect(ok).toBe(true)
    expect(reactionCalls(api).at(-1)).toMatchObject({ url: '/api/posts/a/like', method: 'POST' })
    expect(store.posts.map((post) => post.id)).toEqual(['a', 'b'])
    expect(store.posts[0]).toMatchObject({ liked: true, likeCount: 1, favoriteCount: 0 })
    expect(store.error).toBeNull()
  })

  it('setLiked(false) 调用 DELETE /like 取消点赞', async () => {
    const { api, store } = setup([
      { id: 'a', content: '已点赞', createdAt: 1, liked: true, likeCount: 4 },
    ])
    await store.load()

    const ok = await store.setLiked('a', false)

    expect(ok).toBe(true)
    expect(reactionCalls(api).at(-1)).toMatchObject({ url: '/api/posts/a/like', method: 'DELETE' })
    expect(store.posts[0]).toMatchObject({ liked: false, likeCount: 3 })
  })

  it('setLiked 只影响目标条目，其余条目保持不变', async () => {
    const { store } = setup([
      { id: 'a', content: 'A', createdAt: 2, likeCount: 2 },
      { id: 'b', content: 'B', createdAt: 1, likeCount: 9 },
    ])
    await store.load()

    await store.setLiked('a', true)

    expect(store.posts[0]).toMatchObject({ likeCount: 3, liked: true })
    expect(store.posts[1]).toMatchObject({ likeCount: 9, liked: false })
  })

  // --- 收藏 ---

  it('setFavorited(true) 调用 POST /favorite 且不影响点赞状态', async () => {
    const { api, store } = setup([
      { id: 'a', content: '内容', createdAt: 1, liked: true, likeCount: 1 },
    ])
    await store.load()

    const ok = await store.setFavorited('a', true)

    expect(ok).toBe(true)
    expect(reactionCalls(api).at(-1)).toMatchObject({
      url: '/api/posts/a/favorite',
      method: 'POST',
    })
    expect(store.posts[0]).toMatchObject({
      favorited: true,
      favoriteCount: 1,
      liked: true,
      likeCount: 1,
    })
  })

  it('setFavorited(false) 调用 DELETE /favorite 取消收藏', async () => {
    const { api, store } = setup([
      { id: 'a', content: '内容', createdAt: 1, favorited: true, favoriteCount: 2 },
    ])
    await store.load()

    await expect(store.setFavorited('a', false)).resolves.toBe(true)

    expect(reactionCalls(api).at(-1)).toMatchObject({
      url: '/api/posts/a/favorite',
      method: 'DELETE',
    })
    expect(store.posts[0]).toMatchObject({ favorited: false, favoriteCount: 1 })
  })

  // --- 失败与并发 ---

  it('互动失败时返回 false、保留原状态并暴露可展示错误', async () => {
    const { api, store } = setup([{ id: 'a', content: '内容', createdAt: 1, likeCount: 2 }])
    await store.load()
    api.state.failures.reaction = jsonResponse(
      { error: { code: 'not-found', message: '内容不存在' } },
      404
    )

    const ok = await store.setLiked('a', true)

    expect(ok).toBe(false)
    expect(store.posts[0]).toMatchObject({ liked: false, likeCount: 2 })
    expect(store.error).toBe('内容不存在')
    expect(store.isReacting('a', 'like')).toBe(false)
  })

  it('互动遇到网络异常时退化为通用文案且不抛异常', async () => {
    const { api, store } = setup([{ id: 'a', content: '内容', createdAt: 1 }])
    await store.load()
    api.state.offline = true

    await expect(store.setFavorited('a', true)).resolves.toBe(false)

    expect(store.posts[0]).toMatchObject({ favorited: false, favoriteCount: 0 })
    expect(store.error).toBe('操作失败，请稍后重试')
  })

  it('进行中暴露 isReacting，重复请求被去重只发一次', async () => {
    const { api, store } = setup([{ id: 'a', content: '内容', createdAt: 1 }])
    await store.load()
    let release!: () => void
    api.state.holdReaction = new Promise<void>((resolve) => {
      release = resolve
    })

    const first = store.setLiked('a', true)
    expect(store.isReacting('a', 'like')).toBe(true)

    const duplicate = await store.setLiked('a', true)
    expect(duplicate).toBe(false)
    expect(reactionCalls(api)).toHaveLength(1)

    release()
    await expect(first).resolves.toBe(true)
    expect(store.isReacting('a', 'like')).toBe(false)
    expect(store.posts[0]).toMatchObject({ liked: true, likeCount: 1 })
  })

  it('同一条目的点赞与收藏互不阻塞，各自独立去重', async () => {
    const { api, store } = setup([{ id: 'a', content: '内容', createdAt: 1 }])
    await store.load()
    let release!: () => void
    api.state.holdReaction = new Promise<void>((resolve) => {
      release = resolve
    })

    const liking = store.setLiked('a', true)
    const favoriting = store.setFavorited('a', true)

    expect(store.isReacting('a', 'like')).toBe(true)
    expect(store.isReacting('a', 'favorite')).toBe(true)
    expect(store.isReacting('b', 'like')).toBe(false)
    expect(reactionCalls(api)).toHaveLength(2)

    release()
    await expect(Promise.all([liking, favoriting])).resolves.toEqual([true, true])
    expect(store.posts[0]).toMatchObject({
      liked: true,
      likeCount: 1,
      favorited: true,
      favoriteCount: 1,
    })
    expect(store.isReacting('a', 'like')).toBe(false)
    expect(store.isReacting('a', 'favorite')).toBe(false)
  })

  it('互动成功后清除上一次失败留下的 error', async () => {
    const { api, store } = setup([{ id: 'a', content: '内容', createdAt: 1 }])
    await store.load()
    api.state.offline = true
    await store.setLiked('a', true)
    expect(store.error).toBe('操作失败，请稍后重试')

    api.state.offline = false
    await expect(store.setLiked('a', true)).resolves.toBe(true)

    expect(store.error).toBeNull()
    expect(store.posts[0]).toMatchObject({ liked: true, likeCount: 1 })
  })
})
