import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  MAX_CONTENT_LENGTH,
  type AddPostFailure,
  type AddPostResult,
  type Post,
  type ReactionKind,
} from '@/types/post'
import {
  ApiError,
  createPost,
  deletePost,
  fetchPosts,
  setFavorited as requestSetFavorited,
  setLiked as requestSetLiked,
} from '@/api/posts'

const LOAD_ERROR_MESSAGE = '加载失败，请稍后重试'
const CREATE_ERROR_MESSAGE = '发布失败，请稍后重试'
const DELETE_ERROR_MESSAGE = '删除失败，请稍后重试'
const REACTION_ERROR_MESSAGE = '操作失败，请稍后重试'

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

/** 进行中请求的唯一键：同一条目同一种互动只允许一个在途请求 */
function reactionKey(id: string, kind: ReactionKind): string {
  return `${kind}:${id}`
}

export const usePostsStore = defineStore('posts', () => {
  // --- state ---
  const posts = ref<Post[]>([])
  /** 初次/重新拉取列表进行中 */
  const loading = ref(false)
  /** 可展示给用户的错误文案；null 表示无错误 */
  const error = ref<string | null>(null)
  /** 在途互动请求键集合，供按钮禁用与并发去重 */
  const reactingKeys = ref<string[]>([])

  // --- getters（派生数据，不在模板里重复计算）---
  const sortedPosts = computed(() => [...posts.value].sort((a, b) => b.createdAt - a.createdAt))
  const total = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

  // --- actions ---
  /** 某条内容的某类互动是否在途 */
  function isReacting(id: string, kind: ReactionKind): boolean {
    return reactingKeys.value.includes(reactionKey(id, kind))
  }

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

  /**
   * 点赞/收藏统一流程：同一条同类型请求在途时直接忽略（防抖），
   * 成功后才用服务端返回的实体替换列表项，失败保留原状态并暴露可展示错误。
   */
  async function runReaction(
    id: string,
    kind: ReactionKind,
    request: () => Promise<Post>
  ): Promise<boolean> {
    const key = reactionKey(id, kind)
    if (reactingKeys.value.includes(key)) return false

    reactingKeys.value = [...reactingKeys.value, key]
    try {
      const post = await request()
      posts.value = posts.value.map((item) => (item.id === post.id ? post : item))
      error.value = null
      return true
    } catch (cause) {
      error.value = describeError(cause, REACTION_ERROR_MESSAGE)
      return false
    } finally {
      reactingKeys.value = reactingKeys.value.filter((item) => item !== key)
    }
  }

  /** 点赞 / 取消点赞 */
  async function setLiked(id: string, liked: boolean): Promise<boolean> {
    return runReaction(id, 'like', () => requestSetLiked(id, liked))
  }

  /** 收藏 / 取消收藏 */
  async function setFavorited(id: string, favorited: boolean): Promise<boolean> {
    return runReaction(id, 'favorite', () => requestSetFavorited(id, favorited))
  }

  /** 兼容既有调用方：等价于 load() */
  async function reload(): Promise<void> {
    await load()
  }

  return {
    posts,
    loading,
    error,
    reactingKeys,
    sortedPosts,
    total,
    isEmpty,
    isReacting,
    load,
    addPost,
    removePost,
    setLiked,
    setFavorited,
    reload,
  }
})
