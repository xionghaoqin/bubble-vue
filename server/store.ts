import type { Post } from '../shared/post'

/**
 * 内存仓库接口。路由层只依赖这个抽象，
 * 测试里可以按用例注入独立实例，天然互不污染。
 */
export interface PostStore {
  /** 按 createdAt 倒序返回副本（新的在前） */
  list(): Post[]
  get(id: string): Post | undefined
  /** 写入一条内容（内部会 trim），id/createdAt 由仓库生成 */
  create(content: string): Post
  /** 删除成功返回 true，不存在返回 false */
  remove(id: string): boolean
  clear(): void
  size(): number
}

/**
 * 创建独立的内存仓库。每次调用都是全新实例，
 * 第一阶段不做持久化，进程重启即丢失。
 */
export function createPostStore(seed: Post[] = []): PostStore {
  // 用 Map 存：删除 O(1)，且 list 时再排序比每次写入都重排更简单
  const posts = new Map<string, Post>()

  // 复制种子数据，外部后续改动数组或对象都不会影响仓库
  for (const post of seed) {
    posts.set(post.id, { ...post })
  }

  return {
    list() {
      // 排序 + 拷贝：调用方拿到的是快照，无法顺带改到内部状态
      return [...posts.values()]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((post) => ({ ...post }))
    },
    get(id) {
      const post = posts.get(id)
      return post ? { ...post } : undefined
    },
    create(content) {
      const post: Post = {
        id: crypto.randomUUID(),
        content: content.trim(),
        createdAt: Date.now(),
      }
      posts.set(post.id, post)
      return { ...post }
    },
    remove(id) {
      return posts.delete(id)
    },
    clear() {
      posts.clear()
    },
    size() {
      return posts.size
    },
  }
}
