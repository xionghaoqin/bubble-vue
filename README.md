# 泡泡 bubble · Vue 3 + Hono 版

> 轻声说一句，留下一个泡泡。

用 **Node.js + Vue 3 + Pinia + Hono** 重写的「泡泡」微型发布应用。数据不再落在浏览器 `localStorage`，而是通过 **RESTful API** 写入 Hono 后端的**内存仓库**（进程重启即清空），全程以 **TDD（测试先行）** 方式实现。

原实现（原生 HTML/CSS/JS 版本）保留在 `bubble` 仓库中作为对照。

## 功能

- ✍️ **发布**：输入文字点「发布」，后端生成 `id`/`createdAt` 后返回实体，列表立即出现；纯空白与超过 280 字的内容会被拦截并给出提示
- 📜 **查看**：进入页面自动拉取列表，按 `createdAt` 倒序，显示相对时间（刚刚 / 5 分钟前 / 昨天…）
- 💾 **服务端存储**：刷新页面数据仍在（只要 API 进程还活着）；接口失败时页面不崩，展示可读错误
- ❤️ **点赞 / ⭐ 收藏**：每条卡片可点赞与收藏，再点一次取消；状态与计数以服务端返回为准，重复点击幂等（计数不会膨胀），刷新后仍在
- 🗑️ **删除**：每条卡片带删除按钮，删除成功后同步移除列表
- 🛡️ **安全**：内容通过 Vue 插值渲染（自动转义），不使用 `v-html`，`<script>` 只显示为文本

## 技术栈

| 项 | 选择 |
| --- | --- |
| 运行时 | Node.js 22+ |
| 前端 | Vue 3（Composition API + `<script setup lang="ts">`） |
| 状态管理 | Pinia（setup store，异步 action） |
| 构建 / 开发 | Vite（dev 代理 `/api` → `127.0.0.1:8787`） |
| 后端 | Hono + `@hono/node-server` |
| 存储 | 进程内存（`Map`，可注入种子数据） |
| 测试 | Vitest（前端 happy-dom / 后端 node 双环境）+ Vue Test Utils |
| 类型 | TypeScript（strict，前后端共享 `shared/post.ts` 契约） |

## 快速开始

```bash
npm install
npm run dev          # 同时启动 Vite (5173) 与 Hono API (8787)
npm run dev:web      # 只启动前端
npm run dev:api      # 只启动后端（tsx watch）
npm run test:run     # 运行前后端全部测试
npm run test         # 监听模式
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览构建产物（需另开 npm run dev:api）
```

> 前端只请求相对路径 `/api/**`，开发态由 Vite 代理转发到 Hono，因此不存在跨域问题；后端同时为 `http://localhost:5173` / `http://127.0.0.1:5173` 配了 CORS 兜底。

## REST API

统一错误响应体：`{ "error": { "code": string, "message": string } }`

| 方法 | 路径 | 成功 | 失败 |
| --- | --- | --- | --- |
| GET | `/api/health` | `200 { status: "ok" }` | — |
| GET | `/api/posts` | `200 { posts: Post[] }`（`createdAt` 倒序） | — |
| POST | `/api/posts` | `201 { post }` | `400 empty` / `400 too-long` / `400 invalid-json` |
| GET | `/api/posts/:id` | `200 { post }` | `404 not-found` |
| DELETE | `/api/posts/:id` | `204`（无 body） | `404 not-found` |
| POST | `/api/posts/:id/like` | `200 { post }`（幂等，重复点赞计数不变） | `404 not-found` |
| DELETE | `/api/posts/:id/like` | `200 { post }`（幂等，未点赞也返回当前状态） | `404 not-found` |
| POST | `/api/posts/:id/favorite` | `200 { post }`（幂等） | `404 not-found` |
| DELETE | `/api/posts/:id/favorite` | `200 { post }`（幂等） | `404 not-found` |
| 任意 | 未匹配路由 | — | `404 not-found` |

```bash
curl -s localhost:8787/api/posts
curl -s -X POST localhost:8787/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"content":"你好，泡泡"}'
curl -s -X DELETE localhost:8787/api/posts/<id> -i
curl -s -X POST localhost:8787/api/posts/<id>/like
curl -s -X DELETE localhost:8787/api/posts/<id>/like
curl -s -X POST localhost:8787/api/posts/<id>/favorite
```

`Post = { id, content, createdAt, likeCount, liked, favoriteCount, favorited }`；`content` 会 trim，长度上限 280（恰好 280 允许）。`liked / favorited` 表示当前访客的布尔状态，`*Count` 为对应总数，两者总是一起返回。

## 测试先行（TDD）流程

每个功能都按 **红 → 绿 → 重构** 推进，两个阶段分别由独立子代理完成：

1. **后端阶段**：先写 `server/*.test.ts`（`app.request()` 直打 Hono 实例，无需真实端口）→ 红灯 → 实现 `store.ts` / `app.ts` / `index.ts` → 全绿
2. **前端阶段**：先改写 `src/**/*.test.ts`（用内存假后端替换 `fetch`）→ 红灯 → 实现 `api/posts.ts`、异步 store、页面加载态 → 全绿
3. 主会话负责契约定义、进度跟踪、Code Review 与浏览器验收

点赞/收藏这批需求用 **Git Worktree 并行**完成：主会话先提交 `shared/post.ts` 契约，再开 `feature/reactions-api` 与 `feature/reactions-ui` 两个独立工作树并行 TDD，最后由主会话合并、跑全量测试并在浏览器里点击验收。

当前测试覆盖（**138 个用例，8 个测试文件**）：

| 测试文件 | 用例数 | 覆盖内容 |
| --- | --- | --- |
| `server/store.test.ts` | 24 | 空仓库、创建与去空白、id 唯一、倒序、快照隔离、删除/清空、实例隔离、点赞/收藏计数与幂等、互不影响 |
| `server/app.test.ts` | 38 | health、列表、创建校验（空/超长/非字符串/非法 JSON）、详情、删除幂等、点赞/收藏四条子资源路由、404 透传、未知路由、CORS、实例隔离 |
| `src/stores/posts.test.ts` | 28 | 加载成功/失败/加载态、本地校验不发请求、服务端错误透传、发布/删除/reload、点赞与收藏成功替换实体、失败保留原状态、并发去重 |
| `src/utils/time.test.ts` | 7 | 相对时间各档位与未来时间 |
| `src/components/PostComposer.test.ts` | 8 | 受控输入双向契约、字数统计与警告/超限状态、submit 事件、错误展示 |
| `src/components/PostItem.test.ts` | 10 | 内容与时间渲染、互动计数与 `aria-pressed`、点赞/收藏/删除事件、进行中禁用、XSS 文本化、色相样式 |
| `src/components/PostList.test.ts` | 7 | 列表渲染、空状态、删除/点赞/收藏事件透传、在途态下发 |
| `src/App.test.ts` | 16 | 加载态、初始渲染、发布→列表→清空输入、校验拦截、加载/发布/删除失败提示、点赞与收藏后的数字与高亮、失败提示 |

## 目录结构

```text
bubble-vue/
├── index.html
├── vite.config.ts              # Vite + Vitest 配置（@ / @shared 别名、/api 代理）
├── tsconfig.json
├── shared/
│   └── post.ts                 # 前后端共享契约：Post、280 上限、错误码、响应体
├── server/                     # Hono 后端
│   ├── index.ts                # @hono/node-server 启动（PORT 默认 8787）
│   ├── app.ts                  # 路由、校验、统一错误体、CORS
│   └── store.ts                # 内存仓库（Map + 快照读写）
└── src/
    ├── main.ts                 # 挂载 Vue 与 Pinia
    ├── App.vue                 # 页面编排：加载态 + 发布区 + 列表区
    ├── assets/main.css         # 设计令牌、极光背景、全局动效
    ├── api/posts.ts            # fetch 封装与 ApiError 归一化
    ├── components/
    │   ├── PostComposer.vue    # 发布区（受控输入 + 字数统计 + 错误提示）
    │   ├── PostItem.vue        # 单条卡片（相对时间、多彩光条、删除）
    │   └── PostList.vue        # 列表与空状态
    ├── stores/posts.ts         # Pinia setup store：loading/error/增删查
    ├── utils/
    │   ├── time.ts             # 相对时间格式化（可注入 now，便于测试）
    │   └── id.ts               # 卡片色相推导（id 生成已移交后端）
    ├── types/post.ts           # 前端类型入口，re-export shared 契约
    └── test/setup.ts           # 每个用例后还原被 stub 的 fetch
```

## 架构说明

- **契约唯一来源**：`shared/post.ts` 同时被前后端引用，字段、长度上限、错误码不会两侧漂移
- **分层清晰**：`api/posts.ts` 只做 fetch 与错误归一化 → `stores/posts.ts` 管理状态与业务校验（空/超长不发请求）→ 组件只收发 props/emit
- **异常不穿透**：路由层统一 `{ error: { code, message } }`；store 把网络失败、5xx、不可解析响应都收敛成可展示文案，页面永远不白屏
- **互动幂等**：点赞/收藏用 `POST`（置为）/`DELETE`（取消）表达子资源状态，服务端重复请求不重复计数，并总是回传「最新实体 + 计数 + 当前状态」；前端以服务端返回为准，同一目标的同类请求在途时直接忽略，避免连点造成抖动
- **可测试性**：后端 `createApp({ store })` 支持注入仓库；前端测试用内存假后端替换 `fetch`，断言请求与 DOM 的可观察行为
- **内存存储**：读取返回深拷贝快照，删除 O(1)；进程重启数据清空，后续替换为数据库只需改 `server/store.ts`

## 验收清单

- [x] 发布后列表立即出现，刷新页面内容仍在（服务端内存）
- [x] 列表按时间倒序
- [x] 纯空白不能发布，超 280 字被拦截（前端不发请求 + 后端二次校验）
- [x] `<script>alert(1)</script>` 只显示为文本
- [x] 删除后列表与后端数据同步
- [x] 点赞/收藏后数字与高亮即时更新，再点一次取消
- [x] 重复点赞/收藏幂等（计数不会重复累加），刷新页面状态仍在（服务端内存）
- [x] 接口不可用时展示错误提示，页面不崩溃
- [x] `npm run test:run` 全绿（138 用例 / 8 文件）
- [x] `npm run type-check` 与 `npm run build` 通过
