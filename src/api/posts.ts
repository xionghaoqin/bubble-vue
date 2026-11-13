/**
 * REST 接口封装：只负责 fetch 与错误归一化，不依赖 Vue / Pinia。
 * 全部使用相对路径，开发态由 Vite 把 /api 代理到 Hono 服务。
 */
import type {
  ApiErrorBody,
  ApiErrorCode,
  CreatePostBody,
  Post,
  PostBody,
  PostListBody,
} from '@/types/post'

/** 接口前缀，保持单一来源 */
const API_BASE = '/api'

/** 带业务错误码的接口错误，供 store 决定可展示文案与失败原因 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ApiErrorCode

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false
  const { error } = value as { error?: unknown }
  if (typeof error !== 'object' || error === null) return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  return typeof code === 'string' && typeof message === 'string'
}

/** 非 2xx → ApiError；错误体不可解析时退化为带状态码的通用文案 */
async function toApiError(response: Response): Promise<ApiError> {
  const fallback = `请求失败（${response.status}），请稍后重试`
  try {
    const body: unknown = await response.json()
    if (isApiErrorBody(body)) {
      return new ApiError(body.error.code, response.status, body.error.message || fallback)
    }
  } catch {
    // 响应体不是 JSON（例如代理返回 HTML），走通用文案
  }
  return new ApiError('internal', response.status, fallback)
}

/** GET /api/posts → 后端已按 createdAt 倒序 */
export async function fetchPosts(): Promise<Post[]> {
  const response = await fetch(`${API_BASE}/posts`, {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw await toApiError(response)

  const body = (await response.json()) as PostListBody | null
  if (!body || !Array.isArray(body.posts)) return []
  return body.posts
}

/** POST /api/posts → 服务端生成的完整实体 */
export async function createPost(content: string): Promise<Post> {
  const payload: CreatePostBody = { content }
  const response = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await toApiError(response)

  const body = (await response.json()) as PostBody
  return body.post
}

/** DELETE /api/posts/:id → 204 无响应体 */
export async function deletePost(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw await toApiError(response)
}
