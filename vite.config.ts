import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发态把 /api 透传给 Hono 服务，前端代码只认相对路径
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    // preview 同样需要代理，否则构建产物里的 /api 请求会 404
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    // 前端组件用 happy-dom；server 下的用例通过文件头的
    // `// @vitest-environment node` 切换到 Node 环境
    include: ['src/**/*.{test,spec}.ts', 'server/**/*.{test,spec}.ts'],
  },
})
