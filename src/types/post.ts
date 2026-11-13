/** 一条泡泡内容 */
export interface Post {
  id: string
  content: string
  createdAt: number
}

/** 内容长度上限（字符数） */
export const MAX_CONTENT_LENGTH = 280

/** 本地存储键，与原生版本保持一致，便于数据迁移 */
export const STORAGE_KEY = 'bubble.posts'

export type AddPostFailure = 'empty' | 'too-long'

export type AddPostResult =
  | { ok: true; post: Post }
  | { ok: false; reason: AddPostFailure; message: string }
