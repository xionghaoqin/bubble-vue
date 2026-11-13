import { STORAGE_KEY, type Post } from '@/types/post'

function isPost(value: unknown): value is Post {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Post>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'number'
  )
}

/** 读：localStorage -> 数组；数据损坏或不可用时返回 []，保证应用不崩溃 */
export function readPosts(): Post[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isPost).map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
    }))
  } catch (error) {
    console.warn('[bubble] 本地数据读取失败，已重置为空列表', error)
    return []
  }
}

/** 写：数组 -> localStorage；写入失败只记录日志，不打断用户操作 */
export function writePosts(posts: Post[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
    return true
  } catch (error) {
    console.warn('[bubble] 本地数据写入失败', error)
    return false
  }
}
