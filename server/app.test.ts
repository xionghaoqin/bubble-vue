// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import type { ApiErrorBody, Post, PostBody, PostListBody } from '../shared/post'
import { createApp } from './app'
import { createPostStore } from './store'

let app: ReturnType<typeof createApp>

beforeEach(() => {
  // 每个用例一个全新实例，避免内存数据互相污染
  app = createApp()
})

/** 以 JSON 方式 POST 一条内容（content 故意用 unknown，便于测非字符串） */
async function postJson(content: unknown): Promise<Response> {
  return app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

async function postRaw(body: string): Promise<Response> {
  return app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

/** 预置一条内容（id 固定为 p1），用于验证点赞/收藏路由 */
function seededPostApp(): ReturnType<typeof createApp> {
  const seed: Post = {
    id: 'p1',
    content: '互动测试',
    createdAt: 1,
    likeCount: 0,
    liked: false,
    favoriteCount: 0,
    favorited: false,
  }

  return createApp({ store: createPostStore([seed]) })
}

/** 对指定内容发起点赞/收藏请求 */
async function react(
  target: ReturnType<typeof createApp>,
  id: string,
  kind: 'like' | 'favorite',
  method: 'POST' | 'DELETE' = 'POST',
): Promise<Response> {
  return target.request(`/api/posts/${id}/${kind}`, { method })
}

describe('GET /api/health', () => {
  it('返回 200 与 { status: "ok" }', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/posts', () => {
  it('空仓库返回空数组', async () => {
    const res = await app.request('/api/posts')
    const body = (await res.json()) as PostListBody

    expect(res.status).toBe(200)
    expect(body.posts).toEqual([])
  })

  it('按 createdAt 倒序返回（新的在前）', async () => {
    const seeded = createApp({
      store: createPostStore([
        {
          id: 'a',
          content: '最早',
          createdAt: 1,
          likeCount: 0,
          liked: false,
          favoriteCount: 0,
          favorited: false,
        },
        {
          id: 'b',
          content: '中间',
          createdAt: 2,
          likeCount: 0,
          liked: false,
          favoriteCount: 0,
          favorited: false,
        },
        {
          id: 'c',
          content: '最新',
          createdAt: 3,
          likeCount: 0,
          liked: false,
          favoriteCount: 0,
          favorited: false,
        },
      ]),
    })

    const res = await seeded.request('/api/posts')
    const body = (await res.json()) as PostListBody

    expect(body.posts.map((post) => post.id)).toEqual(['c', 'b', 'a'])
  })

  it('新建的内容排在列表最前面', async () => {
    const seeded = createApp({
      store: createPostStore([
        {
          id: 'old',
          content: '旧内容',
          createdAt: 1,
          likeCount: 0,
          liked: false,
          favoriteCount: 0,
          favorited: false,
        },
      ]),
    })
    const created = (await (
      await seeded.request('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '新内容' }),
      })
    ).json()) as PostBody

    const body = (await (await seeded.request('/api/posts')).json()) as PostListBody

    expect(body.posts[0]).toEqual(created.post)
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201 与完整实体，并去除首尾空白', async () => {
    const res = await postJson('  今天也要开心  ')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(201)
    expect(body.post.content).toBe('今天也要开心')
    expect(typeof body.post.id).toBe('string')
    expect(body.post.id.length).toBeGreaterThan(0)
    expect(typeof body.post.createdAt).toBe('number')
  })

  it('创建后可通过列表与详情读到同一条数据', async () => {
    const created = (await (await postJson('持久化到内存')).json()) as PostBody

    const list = (await (await app.request('/api/posts')).json()) as PostListBody
    const detail = await app.request(`/api/posts/${created.post.id}`)

    expect(list.posts).toHaveLength(1)
    expect((await detail.json()) as PostBody).toEqual(created)
  })

  it('空白内容返回 400 empty', async () => {
    for (const content of ['', '   ', '\n\t ']) {
      const res = await postJson(content)

      expect(res.status).toBe(400)
      expect(((await res.json()) as ApiErrorBody).error).toEqual({
        code: 'empty',
        message: '内容不能为空',
      })
    }
  })

  it('非字符串或缺失 content 返回 400 empty', async () => {
    for (const content of [123, null, undefined, { text: 'hi' }, ['hi']]) {
      const res = await postJson(content)

      expect(res.status).toBe(400)
      expect(((await res.json()) as ApiErrorBody).error.code).toBe('empty')
    }
  })

  it('超过 280 字返回 400 too-long', async () => {
    const res = await postJson('a'.repeat(281))

    expect(res.status).toBe(400)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'too-long',
      message: '内容不能超过 280 字',
    })
  })

  it('恰好 280 字可以创建成功', async () => {
    const res = await postJson('a'.repeat(280))
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(201)
    expect(body.post.content).toHaveLength(280)
  })

  it('非法 JSON 返回 400 invalid-json', async () => {
    const res = await postRaw('{ 这不是 json')

    expect(res.status).toBe(400)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'invalid-json',
      message: '请求体不是合法的 JSON',
    })
  })

  it('空 body 也视为 invalid-json', async () => {
    const res = await app.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status).toBe(400)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('invalid-json')
  })
})

describe('GET /api/posts/:id', () => {
  it('命中返回 200 与实体', async () => {
    const created = (await (await postJson('查我')).json()) as PostBody

    const res = await app.request(`/api/posts/${created.post.id}`)

    expect(res.status).toBe(200)
    expect((await res.json()) as PostBody).toEqual(created)
  })

  it('不存在返回 404 not-found', async () => {
    const res = await app.request('/api/posts/not-exists')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'not-found',
      message: '内容不存在',
    })
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除成功返回 204 空 body，列表随之清空', async () => {
    const created = (await (await postJson('待删除')).json()) as PostBody

    const res = await app.request(`/api/posts/${created.post.id}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(((await (await app.request('/api/posts')).json()) as PostListBody).posts).toEqual([])
  })

  it('删除不存在返回 404 not-found', async () => {
    const res = await app.request('/api/posts/not-exists', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'not-found',
      message: '内容不存在',
    })
  })

  it('同一条数据第二次删除返回 404', async () => {
    const created = (await (await postJson('删两次')).json()) as PostBody

    await app.request(`/api/posts/${created.post.id}`, { method: 'DELETE' })
    const res = await app.request(`/api/posts/${created.post.id}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })
})

describe('未知路由', () => {
  it('未知 /api/* 返回 404 not-found', async () => {
    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('not-found')
  })

  it('根路径也返回 404 而不是 HTML', async () => {
    const res = await app.request('/')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('not-found')
  })
})

describe('CORS', () => {
  it('放行 http://localhost:5173 的预检请求', async () => {
    const res = await app.request('/api/posts', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type',
      },
    })

    expect(res.status).toBeLessThan(300)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('access-control-allow-methods')).toContain('DELETE')
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
  })

  it('放行 http://127.0.0.1:5173 的真实请求', async () => {
    const res = await app.request('/api/posts', {
      headers: { Origin: 'http://127.0.0.1:5173' },
    })

    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
  })

  it('不回显未授权来源', async () => {
    const res = await app.request('/api/posts', {
      headers: { Origin: 'http://evil.example.com' },
    })

    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('实例隔离', () => {
  it('两个 app 实例的数据互不影响', async () => {
    const first = createApp()
    const second = createApp()

    await first.request('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '只写入第一个实例' }),
    })

    const firstList = (await (await first.request('/api/posts')).json()) as PostListBody
    const secondList = (await (await second.request('/api/posts')).json()) as PostListBody

    expect(firstList.posts).toHaveLength(1)
    expect(secondList.posts).toHaveLength(0)
  })

  it('可通过注入 store 复用外部数据', async () => {
    const store = createPostStore([
      {
        id: 'seed',
        content: '种子',
        createdAt: 10,
        likeCount: 0,
        liked: false,
        favoriteCount: 0,
        favorited: false,
      },
    ])
    const injected = createApp({ store })

    const res = await injected.request('/api/posts/seed')

    expect(res.status).toBe(200)
  })
})

describe('POST /api/posts/:id/like', () => {
  it('点赞成功返回 200 与更新后的完整实体', async () => {
    const target = seededPostApp()

    const res = await react(target, 'p1', 'like')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(200)
    expect(body.post).toEqual({
      id: 'p1',
      content: '互动测试',
      createdAt: 1,
      likeCount: 1,
      liked: true,
      favoriteCount: 0,
      favorited: false,
    })
  })

  it('重复点赞幂等，计数保持 1', async () => {
    const target = seededPostApp()

    await react(target, 'p1', 'like')
    const res = await react(target, 'p1', 'like')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(200)
    expect(body.post.likeCount).toBe(1)
    expect(body.post.liked).toBe(true)
  })

  it('列表与详情都能读到最新点赞状态', async () => {
    const target = seededPostApp()

    await react(target, 'p1', 'like')

    const list = (await (await target.request('/api/posts')).json()) as PostListBody
    const detail = (await (await target.request('/api/posts/p1')).json()) as PostBody

    expect(list.posts[0].likeCount).toBe(1)
    expect(list.posts[0].liked).toBe(true)
    expect(detail.post.likeCount).toBe(1)
    expect(detail.post.liked).toBe(true)
  })

  it('内容不存在返回 404 not-found', async () => {
    const res = await react(app, 'not-exists', 'like')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'not-found',
      message: '内容不存在',
    })
  })
})

describe('DELETE /api/posts/:id/like', () => {
  it('取消点赞返回 200 且计数回落为 0', async () => {
    const target = seededPostApp()

    await react(target, 'p1', 'like')
    const res = await react(target, 'p1', 'like', 'DELETE')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(200)
    expect(body.post.liked).toBe(false)
    expect(body.post.likeCount).toBe(0)
    expect(((await (await target.request('/api/posts/p1')).json()) as PostBody).post.liked).toBe(
      false,
    )
  })

  it('未点赞时取消也幂等，计数不为负', async () => {
    const target = seededPostApp()

    const res = await react(target, 'p1', 'like', 'DELETE')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(200)
    expect(body.post.liked).toBe(false)
    expect(body.post.likeCount).toBe(0)
  })

  it('内容不存在返回 404 not-found', async () => {
    const res = await react(app, 'not-exists', 'like', 'DELETE')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'not-found',
      message: '内容不存在',
    })
  })
})

describe('POST /api/posts/:id/favorite', () => {
  it('收藏成功返回 200 与更新后的完整实体', async () => {
    const target = seededPostApp()

    const res = await react(target, 'p1', 'favorite')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(200)
    expect(body.post.favorited).toBe(true)
    expect(body.post.favoriteCount).toBe(1)
    expect(body.post.liked).toBe(false)
    expect(body.post.likeCount).toBe(0)
  })

  it('重复收藏幂等，计数保持 1', async () => {
    const target = seededPostApp()

    await react(target, 'p1', 'favorite')
    const body = (await (await react(target, 'p1', 'favorite')).json()) as PostBody

    expect(body.post.favoriteCount).toBe(1)
  })

  it('内容不存在返回 404 not-found', async () => {
    const res = await react(app, 'not-exists', 'favorite')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error).toEqual({
      code: 'not-found',
      message: '内容不存在',
    })
  })
})

describe('DELETE /api/posts/:id/favorite', () => {
  it('取消收藏返回 200 且计数回落为 0', async () => {
    const target = seededPostApp()

    await react(target, 'p1', 'favorite')
    const res = await react(target, 'p1', 'favorite', 'DELETE')
    const body = (await res.json()) as PostBody

    expect(res.status).toBe(200)
    expect(body.post.favorited).toBe(false)
    expect(body.post.favoriteCount).toBe(0)
  })

  it('未收藏时取消也幂等', async () => {
    const target = seededPostApp()

    const body = (await (await react(target, 'p1', 'favorite', 'DELETE')).json()) as PostBody

    expect(body.post.favorited).toBe(false)
    expect(body.post.favoriteCount).toBe(0)
  })

  it('内容不存在返回 404 not-found', async () => {
    const res = await react(app, 'not-exists', 'favorite', 'DELETE')

    expect(res.status).toBe(404)
    expect(((await res.json()) as ApiErrorBody).error.code).toBe('not-found')
  })
})

describe('点赞与收藏互不影响', () => {
  it('同时点赞与收藏后两者状态独立保持', async () => {
    const target = seededPostApp()

    await react(target, 'p1', 'like')
    await react(target, 'p1', 'favorite')

    const both = (await (await target.request('/api/posts/p1')).json()) as PostBody
    expect(both.post.liked).toBe(true)
    expect(both.post.likeCount).toBe(1)
    expect(both.post.favorited).toBe(true)
    expect(both.post.favoriteCount).toBe(1)

    const unliked = (await (await react(target, 'p1', 'like', 'DELETE')).json()) as PostBody
    expect(unliked.post.liked).toBe(false)
    expect(unliked.post.likeCount).toBe(0)
    expect(unliked.post.favorited).toBe(true)
    expect(unliked.post.favoriteCount).toBe(1)
  })
})
