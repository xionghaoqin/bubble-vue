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
  /** 当前访客点赞：重复点赞幂等，返回更新后的副本；不存在返回 undefined */
  like(id: string): Post | undefined
  /** 当前访客取消点赞：未点赞也幂等，返回更新后的副本；不存在返回 undefined */
  unlike(id: string): Post | undefined
  /** 当前访客收藏：重复收藏幂等，返回更新后的副本；不存在返回 undefined */
  favorite(id: string): Post | undefined
  /** 当前访客取消收藏：未收藏也幂等，返回更新后的副本；不存在返回 undefined */
  unfavorite(id: string): Post | undefined
  clear(): void
  size(): number
}

/**
 * 补齐互动字段的默认值。
 * 种子数据可能来自契约升级前的旧数据，运行时兜底避免出现 undefined。
 */
function normalize(post: Post): Post {
  return {
    ...post,
    likeCount: post.likeCount ?? 0,
    liked: post.liked ?? false,
    favoriteCount: post.favoriteCount ?? 0,
    favorited: post.favorited ?? false,
  }
}

/**
 * 创建独立的内存仓库。每次调用都是全新实例，
 * 第一阶段不做持久化，进程重启即丢失。
 */
export function createPostStore(seed: Post[] = []): PostStore {
  // 用 Map 存：删除 O(1)，且 list 时再排序比每次写入都重排更简单
  const posts = new Map<string, Post>()

  // 复制种子数据并归一化，外部后续改动数组或对象都不会影响仓库
  for (const post of seed) {
    posts.set(post.id, normalize(post))
  }

  /** 互动操作的公共骨架：找到实体、就地更新、返回副本 */
  function mutate(id: string, apply: (post: Post) => void): Post | undefined {
    const post = posts.get(id)
    if (!post) {
      return undefined
    }

    apply(post)
    return { ...post }
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
        likeCount: 0,
        liked: false,
        favoriteCount: 0,
        favorited: false,
      }
      posts.set(post.id, post)
      return { ...post }
    },
    remove(id) {
      return posts.delete(id)
    },
    like(id) {
      return mutate(id, (post) => {
        // 已点赞直接返回，保证重复点击不会重复计数
        if (post.liked) return
        post.liked = true
        post.likeCount += 1
      })
    },
    unlike(id) {
      return mutate(id, (post) => {
        if (!post.liked) return
        post.liked = false
        post.likeCount -= 1
      })
    },
    favorite(id) {
      return mutate(id, (post) => {
        if (post.favorited) return
        post.favorited = true
        post.favoriteCount += 1
      })
    },
    unfavorite(id) {
      return mutate(id, (post) => {
        if (!post.favorited) return
        post.favorited = false
        post.favoriteCount -= 1
      })
    },
    clear() {
      posts.clear()
    },
    size() {
      return posts.size
    },
  }
}
