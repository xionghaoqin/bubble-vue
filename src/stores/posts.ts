import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  MAX_CONTENT_LENGTH,
  type AddPostFailure,
  type AddPostResult,
  type Post,
} from '@/types/post'
import { ApiError, createPost, deletePost, fetchPosts } from '@/api/posts'

const LOAD_ERROR_MESSAGE = '加载失败，请稍后重试'
const CREATE_ERROR_MESSAGE = '发布失败，请稍后重试'
const DELETE_ERROR_MESSAGE = '删除失败，请稍后重试'

/** 优先展示接口给出的业务文案，否则退化为场景化的通用文案 */
function describeError(cause: unknown, fallback: string): string {
  if (cause instanceof ApiError && cause.message) return cause.message
  return fallback
}

/** 服务端 400 的 empty/too-long 直接透传；其余（5xx、断网、解析失败）统一算 network */
function toAddFailure(cause: unknown): { reason: AddPostFailure | 'network'; message: string } {
  if (cause instanceof ApiError && (cause.code === 'empty' || cause.code === 'too-long')) {
    return { reason: cause.code, message: describeError(cause, CREATE_ERROR_MESSAGE) }
  }
  return { reason: 'network', message: describeError(cause, CREATE_ERROR_MESSAGE) }
}

export const usePostsStore = defineStore('posts', () => {
  // --- state ---
  const posts = ref<Post[]>([])
  /** 初次/重新拉取列表进行中 */
  const loading = ref(false)
  /** 可展示给用户的错误文案；null 表示无错误 */
  const error = ref<string | null>(null)

  // --- getters（派生数据，不在模板里重复计算）---
  const sortedPosts = computed(() => [...posts.value].sort((a, b) => b.createdAt - a.createdAt))
  const total = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

  // --- actions ---
  /** 拉取列表：失败时保留现有列表并暴露 error，不抛出（页面不崩） */
  async function load(): Promise<void> {
    loading.value = true
    try {
      posts.value = await fetchPosts()
      error.value = null
    } catch (cause) {
      error.value = describeError(cause, LOAD_ERROR_MESSAGE)
    } finally {
      loading.value = false
    }
  }

  /** 发布：先本地校验（不发请求），再由服务端生成实体并插入列表 */
  async function addPost(content: string): Promise<AddPostResult> {
    const text = String(content ?? '').trim()

    if (!text) {
      return { ok: false, reason: 'empty', message: '内容不能为空' }
    }
    if (text.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        reason: 'too-long',
        message: `内容不能超过 ${MAX_CONTENT_LENGTH} 字`,
      }
    }

    try {
      const post = await createPost(text)
      posts.value = [...posts.value, post]
      error.value = null
      return { ok: true, post }
    } catch (cause) {
      const failure = toAddFailure(cause)
      error.value = failure.message
      return { ok: false, reason: failure.reason, message: failure.message }
    }
  }

  /** 删除：接口成功后才移除本地条目 */
  async function removePost(id: string): Promise<boolean> {
    try {
      await deletePost(id)
      posts.value = posts.value.filter((post) => post.id !== id)
      error.value = null
      return true
    } catch (cause) {
      error.value = describeError(cause, DELETE_ERROR_MESSAGE)
      return false
    }
  }

  /** 兼容既有调用方：等价于 load() */
  async function reload(): Promise<void> {
    await load()
  }

  return { posts, loading, error, sortedPosts, total, isEmpty, load, addPost, removePost, reload }
})
