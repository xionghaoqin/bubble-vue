import { afterEach, vi } from 'vitest'

// 每个用例结束后还原被 stub 的全局对象（主要是 fetch 的内存假后端），
// 避免用例之间互相污染；不再需要清理 localStorage（数据已迁移到 REST API）。
afterEach(() => {
  vi.unstubAllGlobals()
})
