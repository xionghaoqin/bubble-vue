# 泡泡 bubble · Vue 3 版

> 轻声说一句，留下一个泡泡。

用 **Node.js + Vue 3 + Pinia** 重写的「泡泡」微型发布应用，数据依然存放在浏览器 `localStorage`（键 `bubble.posts`），全程以 **TDD（测试先行）** 方式实现。

原实现（原生 HTML/CSS/JS 版本）保留在 `bubble` 仓库中作为对照。

## 功能

- ✍️ **发布**：输入文字点「发布」，列表立即出现；纯空白与超过 280 字的内容会被拦截并给出提示
- 📜 **查看**：列表按 `createdAt` 倒序，显示相对时间（刚刚 / 5 分钟前 / 昨天…）
- 💾 **持久化**：刷新或关闭浏览器后内容仍在；本地数据损坏时自动兜底为空列表
- 🗑️ **删除**：每条卡片带删除按钮，删除后同步写回存储
- 🛡️ **安全**：内容通过 Vue 插值渲染（自动转义），不使用 `v-html`，`<script>` 只显示为文本

## 技术栈

| 项 | 选择 |
| --- | --- |
| 运行时 | Node.js 22 |
| 框架 | Vue 3（Composition API + `<script setup lang="ts">`） |
| 状态管理 | Pinia（setup store） |
| 构建 | Vite |
| 测试 | Vitest + Vue Test Utils + happy-dom |
| 类型 | TypeScript（strict） |
| 存储 | `localStorage`（键 `bubble.posts`） |

## 快速开始

```bash
npm install
npm run dev          # 开发服务器 http://localhost:5173
npm run test:run     # 运行全部单元与集成测试
npm run test         # 监听模式
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览构建产物
```

## 测试先行（TDD）流程

每个功能都按 **红 → 绿 → 重构** 推进，可以按提交历史回看：

1. 先写失败用例（`src/**/*.test.ts`）
2. 运行 `npm run test:run` 确认红灯
3. 写最小实现让用例转绿
4. 必要时重构，测试始终作为安全网

当前测试覆盖（44 个用例，6 个测试文件）：

| 测试文件 | 覆盖内容 |
| --- | --- |
| `src/stores/posts.test.ts` | 初始化读取、发布校验（空/超长/去空白）、倒序、删除、损坏数据兜底、写入失败不崩溃 |
| `src/utils/time.test.ts` | 相对时间各档位与未来时间 |
| `src/components/PostComposer.test.ts` | 受控输入双向契约、字数统计与警告/超限状态、submit 事件、错误展示 |
| `src/components/PostItem.test.ts` | 内容与时间渲染、删除事件、XSS 文本化、色相样式 |
| `src/components/PostList.test.ts` | 列表渲染、空状态、事件透传 |
| `src/App.test.ts` | 发布→列表→存储的集成链路、校验提示、清空输入、刷新后倒序、删除同步 |

## 目录结构

```text
bubble-vue/
├── index.html
├── vite.config.ts          # Vite + Vitest 配置（happy-dom 环境、@ 别名）
├── tsconfig.json
├── public/favicon.svg
└── src/
    ├── main.ts             # 挂载 Vue 与 Pinia
    ├── App.vue             # 页面编排：标题栏 + 发布区 + 列表区
    ├── assets/main.css     # 设计令牌、极光背景、全局动效
    ├── components/
    │   ├── PostComposer.vue    # 发布区（受控输入 + 字数统计 + 错误提示）
    │   ├── PostItem.vue        # 单条卡片（相对时间、多彩光条、删除）
    │   └── PostList.vue        # 列表与空状态
    ├── stores/posts.ts     # Pinia setup store：状态 + 派生 + 增删
    ├── utils/
    │   ├── storage.ts      # localStorage 读写与异常兜底
    │   ├── time.ts         # 相对时间格式化（可注入 now，便于测试）
    │   └── id.ts           # id 生成与卡片色相推导
    ├── types/post.ts       # 数据模型与常量
    └── test/setup.ts       # 每个用例前清空 localStorage
```

## 架构说明

- **状态唯一来源**：`usePostsStore` 持有 `posts`，`sortedPosts` / `total` / `isEmpty` 全部用 `computed` 派生，组件不在模板里做排序或过滤
- **存储隔离**：只有 `utils/storage.ts` 触碰 `localStorage`，store 通过它读写；将来换存储介质只改一个文件
- **组件契约**：`PostComposer` 用 `v-model` 传草稿、`submit` 上抛；`PostItem` 收 `post`、抛 `remove`；`PostList` 只负责编排与空状态
- **视觉**：暗色霓虹风格（极光背景、玻璃拟态、渐变描边、输入文字炫彩渐变）通过 `scoped` 样式下沉到各组件，设计令牌集中在 `assets/main.css`

## 验收清单

- [x] 发布后列表立即出现
- [x] 列表按时间倒序
- [x] 刷新 / 重开浏览器内容仍在
- [x] 纯空白不能发布，超 280 字被拦截
- [x] `<script>alert(1)</script>` 只显示为文本
- [x] 删除后列表与存储同步
- [x] `npm run test:run` 全绿（44 用例）
- [x] `npm run type-check` 与 `npm run build` 通过
