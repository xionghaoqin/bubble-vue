/** 生成帖子 id：优先 UUID，环境不支持时退化为「时间戳 + 随机数」 */
export function createPostId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** 由 id 推导卡片色相（0-359），让每条卡片都有稳定的多彩光条 */
export function hueFromId(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360
  }
  return hash
}
