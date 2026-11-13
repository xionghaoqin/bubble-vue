/**
 * 前后端共享契约：数据模型、校验常量与 REST 响应结构。
 * 前端（src/**）与后端（server/**）都从这里导入，避免两侧字段漂移。
 */

/** 一条泡泡内容 */
export interface Post {
  id: string
  content: string
  createdAt: number
}

/** 内容长度上限（字符数） */
export const MAX_CONTENT_LENGTH = 280

/** 后端可返回的业务错误码 */
export type ApiErrorCode =
  | 'empty'
  | 'too-long'
  | 'not-found'
  | 'invalid-json'
  | 'method-not-allowed'
  | 'internal'

/** 统一错误响应体：{ error: { code, message } } */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
  }
}

/** GET /api/posts 响应体，已按 createdAt 倒序 */
export interface PostListBody {
  posts: Post[]
}

/** 单条资源响应体 */
export interface PostBody {
  post: Post
}

/** 创建请求体 */
export interface CreatePostBody {
  content: string
}

/** 前端本地校验失败原因（与后端错误码保持一致） */
export type AddPostFailure = Extract<ApiErrorCode, 'empty' | 'too-long'>

/** 前端发布结果：成功带服务端返回的实体，失败带可展示的文案 */
export type AddPostResult =
  | { ok: true; post: Post }
  | { ok: false; reason: AddPostFailure | 'network'; message: string }
