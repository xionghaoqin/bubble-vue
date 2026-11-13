import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import App from '@/App.vue'
import { MAX_CONTENT_LENGTH, type Post, type ReactionKind } from '@/types/post'

// --- 内存假后端：与 stores/posts.test.ts 同构，覆盖页面级可观察行为 ---

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
    holdList: null as Promise<void> | null,
    holdReaction: null as Promise<void> | null,
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

/** 等待挂起的微任务（fetch → store → 渲染）全部落地 */
async function settle(): Promise<void> {
  await flushPromises()
  await nextTick()
}

type Wrapper = ReturnType<typeof mount>

function mountWithFetch(api: ReturnType<typeof createFetchMock>) {
  vi.stubGlobal('fetch', api.fetchMock)
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(App, { global: { plugins: [pinia] } })
}

async function mountApp(initialPosts: PostFixture[] = []) {
  const api = createFetchMock(initialPosts)
  const wrapper = mountWithFetch(api)
  await settle()
  return { wrapper, api }
}

async function publish(wrapper: Wrapper, text: string): Promise<void> {
  await wrapper.find('[data-testid="composer-input"]').setValue(text)
  await wrapper.find('[data-testid="composer-submit"]').trigger('click')
  await settle()
}

function postCount(wrapper: Wrapper): number {
  return wrapper.findAll('[data-testid="post-item"]').length
}

function composerError(wrapper: Wrapper): string {
  const node = wrapper.find('[data-testid="composer-error"]')
  return node.exists() ? node.text() : ''
}

function postsCalls(api: ReturnType<typeof createFetchMock>, method: string): RecordedCall[] {
  return api.calls.filter((call) => call.method === method)
}

function countText(wrapper: Wrapper, testId: 'post-like-count' | 'post-favorite-count'): string {
  return wrapper.get(`[data-testid="${testId}"]`).text()
}

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始加载后展示服务端数据并按时间倒序', async () => {
    const { wrapper } = await mountApp([
      { id: 'old', content: '旧内容', createdAt: 1000 },
      { id: 'new', content: '新内容', createdAt: 2000 },
    ])

    const items = wrapper.findAll('[data-testid="post-item"]')

    expect(items).toHaveLength(2)
    expect(items[0]?.text()).toContain('新内容')
    expect(items[1]?.text()).toContain('旧内容')
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(false)
  })

  it('服务端无数据时展示空状态', async () => {
    const { wrapper } = await mountApp()

    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(true)
    expect(postCount(wrapper)).toBe(0)
  })

  it('列表加载中显示 feed-loading', async () => {
    const api = createFetchMock()
    let release!: () => void
    api.state.holdList = new Promise<void>((resolve) => {
      release = resolve
    })

    const wrapper = mountWithFetch(api)
    await nextTick()

    expect(wrapper.find('[data-testid="feed-loading"]').exists()).toBe(true)

    release()
    await settle()

    expect(wrapper.find('[data-testid="feed-loading"]').exists()).toBe(false)
  })

  it('加载失败时展示错误提示且页面仍可用', async () => {
    const api = createFetchMock()
    api.state.offline = true

    const wrapper = mountWithFetch(api)
    await settle()

    expect(composerError(wrapper)).toBe('加载失败，请稍后重试')
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="composer-submit"]').exists()).toBe(true)
  })

  it('发布后列表出现该条并清空输入框', async () => {
    const { wrapper, api } = await mountApp()

    await publish(wrapper, '第一条泡泡')

    expect(postCount(wrapper)).toBe(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('第一条泡泡')
    expect((wrapper.find('[data-testid="composer-input"]').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find('[data-testid="composer-counter"]').text()).toBe('0/280')

    const created = postsCalls(api, 'POST')
    expect(created).toHaveLength(1)
    expect(JSON.parse(created[0]?.body ?? '{}')).toEqual({ content: '第一条泡泡' })
  })

  it('纯空白内容被拦截且不发起发布请求', async () => {
    const { wrapper, api } = await mountApp()

    await publish(wrapper, '    ')

    expect(composerError(wrapper)).toBe('内容不能为空')
    expect(postCount(wrapper)).toBe(0)
    expect(postsCalls(api, 'POST')).toHaveLength(0)
  })

  it('超过 280 字被拦截且不发起发布请求', async () => {
    const { wrapper, api } = await mountApp()

    await publish(wrapper, 'a'.repeat(MAX_CONTENT_LENGTH + 1))

    expect(composerError(wrapper)).toBe('内容不能超过 280 字')
    expect(postCount(wrapper)).toBe(0)
    expect(postsCalls(api, 'POST')).toHaveLength(0)
  })

  it('再次成功发布后错误提示消失', async () => {
    const { wrapper } = await mountApp()

    await publish(wrapper, '   ')
    expect(composerError(wrapper)).toBe('内容不能为空')

    await publish(wrapper, '正常内容')

    expect(wrapper.find('[data-testid="composer-error"]').exists()).toBe(false)
    expect(postCount(wrapper)).toBe(1)
  })

  it('发布接口失败时展示错误文案并保留草稿', async () => {
    const { wrapper, api } = await mountApp()
    api.state.failures.create = jsonResponse(
      { error: { code: 'internal', message: '服务器开小差了' } },
      500
    )

    await publish(wrapper, '发不出去的内容')

    expect(composerError(wrapper)).toBe('服务器开小差了')
    expect(postCount(wrapper)).toBe(0)
    expect((wrapper.find('[data-testid="composer-input"]').element as HTMLTextAreaElement).value).toBe(
      '发不出去的内容'
    )
  })

  it('点击删除后调用 DELETE 并移除该条', async () => {
    const { wrapper, api } = await mountApp([{ id: 'only', content: '要删掉的', createdAt: 1000 }])

    await wrapper.find('[data-testid="post-delete"]').trigger('click')
    await settle()

    expect(postCount(wrapper)).toBe(0)
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(true)
    expect(api.calls.at(-1)).toMatchObject({ url: '/api/posts/only', method: 'DELETE' })
  })

  it('删除失败时保留列表并展示错误提示', async () => {
    const { wrapper, api } = await mountApp([{ id: 'only', content: '删不掉', createdAt: 1000 }])
    api.state.failures.remove = jsonResponse(
      { error: { code: 'not-found', message: '内容不存在' } },
      404
    )

    await wrapper.find('[data-testid="post-delete"]').trigger('click')
    await settle()

    expect(postCount(wrapper)).toBe(1)
    expect(composerError(wrapper)).toBe('内容不存在')
  })

  // --- 点赞与收藏 ---

  it('点击点赞后调用 POST 并用服务端计数与高亮更新 UI', async () => {
    const { wrapper, api } = await mountApp([{ id: 'p1', content: '可点赞', createdAt: 1000 }])

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await settle()

    expect(api.calls.at(-1)).toMatchObject({ url: '/api/posts/p1/like', method: 'POST' })
    expect(countText(wrapper, 'post-like-count')).toBe('1')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-label')).toBe('取消点赞')
    expect(countText(wrapper, 'post-favorite-count')).toBe('0')
  })

  it('再次点击点赞按钮改为 DELETE 并回落计数', async () => {
    const { wrapper, api } = await mountApp([
      { id: 'p1', content: '已点赞', createdAt: 1000, likeCount: 5, liked: true },
    ])

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await settle()

    expect(api.calls.at(-1)).toMatchObject({ url: '/api/posts/p1/like', method: 'DELETE' })
    expect(countText(wrapper, 'post-like-count')).toBe('4')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('false')
  })

  it('点击收藏后调用 POST /favorite 且不影响点赞', async () => {
    const { wrapper, api } = await mountApp([{ id: 'p1', content: '可收藏', createdAt: 1000 }])

    await wrapper.get('[data-testid="post-favorite"]').trigger('click')
    await settle()

    expect(api.calls.at(-1)).toMatchObject({ url: '/api/posts/p1/favorite', method: 'POST' })
    expect(countText(wrapper, 'post-favorite-count')).toBe('1')
    expect(wrapper.get('[data-testid="post-favorite"]').attributes('aria-pressed')).toBe('true')
    expect(countText(wrapper, 'post-like-count')).toBe('0')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('false')
  })

  it('互动失败时计数与高亮保持原样并展示错误', async () => {
    const { wrapper, api } = await mountApp([
      { id: 'p1', content: '点不动', createdAt: 1000, likeCount: 2 },
    ])
    api.state.failures.reaction = jsonResponse(
      { error: { code: 'not-found', message: '内容不存在' } },
      404
    )

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await settle()

    expect(countText(wrapper, 'post-like-count')).toBe('2')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('false')
    expect(composerError(wrapper)).toBe('内容不存在')
  })

  it('互动请求进行中按钮禁用，避免重复提交', async () => {
    const { wrapper, api } = await mountApp([{ id: 'p1', content: '慢一点', createdAt: 1000 }])
    let release!: () => void
    api.state.holdReaction = new Promise<void>((resolve) => {
      release = resolve
    })

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await nextTick()

    expect(wrapper.get('[data-testid="post-like"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="post-like"]').classes()).toContain('is-pending')

    release()
    await settle()

    expect(wrapper.get('[data-testid="post-like"]').attributes('disabled')).toBeUndefined()
    expect(countText(wrapper, 'post-like-count')).toBe('1')
    expect(api.calls.filter((call) => call.url.endsWith('/like'))).toHaveLength(1)
  })
})
