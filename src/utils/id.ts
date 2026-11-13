/**
 * 由 id 推导卡片色相（0-359），让每条卡片都有稳定的多彩光条。
 * id 的生成已移交后端（crypto.randomUUID），前端只负责展示。
 */
export function hueFromId(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 360
  }
  return hash
}
