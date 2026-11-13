/**
 * 前端类型入口：全部复用 `shared/post.ts` 的契约，
 * 保证与 Hono 后端使用同一套字段与常量。
 */
export type {
  AddPostFailure,
  AddPostResult,
  ApiErrorBody,
  ApiErrorCode,
  CreatePostBody,
  Post,
  PostBody,
  PostListBody,
} from '@shared/post'

export { MAX_CONTENT_LENGTH } from '@shared/post'
