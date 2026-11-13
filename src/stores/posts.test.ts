import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePostsStore } from '@/stores/posts'
import { MAX_CONTENT_LENGTH, type Post } from '@/types/post'

// --- 内存假后端：把 fetch 换成受控实现，断言只看「请求 + 状态变化」 ---

interface RecordedCall {
  url: string
  method: string
  body?: string
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

function createFetchMock(initialPosts: Post[] = []) {
  const db = new Map(initialPosts.map((post) => [post.id, post]))
  const calls: RecordedCall[] = []
  let nextId = 1

  const state = {
    /** 非空时 GET 列表会挂起，直到测试手动 resolve */
    holdList: null as Promise<void> | null,
    /** true 时所有请求立即 reject，模拟断网 */
    offline: false,
    failures: {
      list: null as Response | null,
      create: null as Response | null,
      remove: null as Response | null,
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
      const post: Post = { id: `srv-${nextId}`, content, createdAt: 1_000_000 + nextId }
      nextId += 1
      db.set(post.id, post)
      return jsonResponse({ post }, 201)
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
function setup(initialPosts: Post[] = []) {
  const api = createFetchMock(initialPosts)
  vi.stubGlobal('fetch', api.fetchMock)
  const store = usePostsStore()
  return { api, store }
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

    api.db.set('x', { id: 'x', content: '外部写入', createdAt: 5 })
    await store.reload()

    expect(store.total).toBe(1)
    expect(store.posts[0]?.content).toBe('外部写入')
    expect(api.calls).toHaveLength(1)
  })
})
