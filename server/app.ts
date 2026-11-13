import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  MAX_CONTENT_LENGTH,
  type ApiErrorBody,
  type ApiErrorCode,
  type PostBody,
  type PostListBody,
} from '../shared/post'
import { createPostStore, type PostStore } from './store'

export interface CreateAppOptions {
  /** 注入仓库（测试用）；不传则每个 app 自带一个新实例 */
  store?: PostStore
}

/** 本地开发时允许的前端来源 */
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173']

const POST_NOT_FOUND_MESSAGE = '内容不存在'
const ROUTE_NOT_FOUND_MESSAGE = '接口不存在'

/** 统一错误响应体，保证前端只需处理一种错误结构 */
function errorBody(code: ApiErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } }
}

/**
 * 组装 Hono 应用。不在这里监听端口，
 * 方便测试直接用 `app.request()` 发请求。
 */
export function createApp(options: CreateAppOptions = {}): Hono {
  const store = options.store ?? createPostStore()

  const app = new Hono()

  // 前端 dev server 与 API 端口不同，必须放行跨域；预检交给 hono/cors
  app.use(
    '/api/*',
    cors({
      origin: ALLOWED_ORIGINS,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  )

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/posts', (c) => {
    const body: PostListBody = { posts: store.list() }
    return c.json(body)
  })

  app.post('/api/posts', async (c) => {
    // 先单独接住 JSON 解析失败：空 body、残缺 JSON 都归到 invalid-json
    let payload: unknown
    try {
      payload = await c.req.json()
    } catch {
      return c.json(errorBody('invalid-json', '请求体不是合法的 JSON'), 400)
    }

    const content = (payload as { content?: unknown } | null)?.content

    // 非字符串（含缺失、null、数字等）与纯空白都视为未填写
    if (typeof content !== 'string' || content.trim() === '') {
      return c.json(errorBody('empty', '内容不能为空'), 400)
    }

    const text = content.trim()
    if (text.length > MAX_CONTENT_LENGTH) {
      return c.json(errorBody('too-long', `内容不能超过 ${MAX_CONTENT_LENGTH} 字`), 400)
    }

    const body: PostBody = { post: store.create(text) }
    return c.json(body, 201)
  })

  app.get('/api/posts/:id', (c) => {
    const post = store.get(c.req.param('id'))
    if (!post) {
      return c.json(errorBody('not-found', POST_NOT_FOUND_MESSAGE), 404)
    }

    const body: PostBody = { post }
    return c.json(body)
  })

  app.delete('/api/posts/:id', (c) => {
    if (!store.remove(c.req.param('id'))) {
      return c.json(errorBody('not-found', POST_NOT_FOUND_MESSAGE), 404)
    }

    return c.body(null, 204)
  })

  app.notFound((c) => c.json(errorBody('not-found', ROUTE_NOT_FOUND_MESSAGE), 404))

  // 兜底：任何未捕获异常都收敛成统一错误体，避免把堆栈暴露给前端
  app.onError((error, c) => {
    console.error('[bubble-api] 未捕获异常', error)
    return c.json(errorBody('internal', '服务器内部错误'), 500)
  })

  return app
}
