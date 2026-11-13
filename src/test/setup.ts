import { beforeEach } from 'vitest'

// 每个测试都从干净的 localStorage 开始，避免用例之间互相污染
beforeEach(() => {
  localStorage.clear()
})
