import { serve } from '@hono/node-server'
import { createApp } from './app'

// 端口可被环境变量覆盖，便于 CI 或端口冲突时改道
const port = Number(process.env.PORT ?? 8787)
const app = createApp()

serve({ fetch: app.fetch, port, hostname: '127.0.0.1' }, (info) => {
  console.log(`[bubble-api] listening on http://127.0.0.1:${info.port}`)
})
