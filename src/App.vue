<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PostComposer from '@/components/PostComposer.vue'
import PostList from '@/components/PostList.vue'
import { usePostsStore } from '@/stores/posts'
import { MAX_CONTENT_LENGTH } from '@/types/post'

const postsStore = usePostsStore()

const draft = ref('')
/** 本地校验 / 发布失败的文案，优先于 store 的接口错误展示 */
const formError = ref<string | null>(null)

// composer 只有一个错误位：本次操作的错误优先，否则展示 store 的接口错误
const errorMessage = computed(() => formError.value ?? postsStore.error)

onMounted(() => {
  void postsStore.load()
})

async function handleSubmit(): Promise<void> {
  formError.value = null
  const result = await postsStore.addPost(draft.value)

  if (result.ok) {
    draft.value = ''
    return
  }

  formError.value = result.message
}

async function handleRemove(id: string): Promise<void> {
  await postsStore.removePost(id)
}
</script>

<template>
  <main class="container">
    <header class="header">
      <h1 class="app-title">
        <span class="app-logo" aria-hidden="true">🫧</span>
        泡泡
        <span class="app-subtitle">bubble</span>
      </h1>
      <p class="app-tagline">轻声说一句，留下一个泡泡</p>
    </header>

    <PostComposer
      v-model="draft"
      :max-length="MAX_CONTENT_LENGTH"
      :error="errorMessage"
      @submit="handleSubmit"
    />

    <p v-if="postsStore.loading" class="feed-loading" data-testid="feed-loading">正在加载…</p>
    <PostList v-else :posts="postsStore.sortedPosts" @remove="handleRemove" />
  </main>
</template>

<style scoped>
.container {
  position: relative;
  z-index: 1;
  max-width: 620px;
  margin: 0 auto;
}

.header {
  padding: 12px 0 28px;
  text-align: center;
}

.app-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  background: linear-gradient(
    100deg,
    #22d3ee,
    #8b5cf6 32%,
    #f472b6 58%,
    #fbbf24 82%,
    #22d3ee
  );
  background-size: 260% 100%;
  color: transparent;
  font-size: 34px;
  font-weight: 800;
  letter-spacing: 3px;
  animation: hueflow 9s linear infinite;
  filter: drop-shadow(0 0 24px rgba(139, 92, 246, 0.55));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.app-logo {
  font-size: 28px;
  filter: drop-shadow(0 0 14px rgba(34, 211, 238, 0.8));
  animation: bob 4s ease-in-out infinite;
  -webkit-text-fill-color: initial;
}

.app-subtitle {
  color: var(--muted);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 4px;
  text-transform: uppercase;
  -webkit-text-fill-color: var(--muted);
}

.app-tagline {
  margin-top: 10px;
  color: var(--muted);
  font-size: 13px;
  letter-spacing: 1px;
}

.feed-loading {
  margin-top: 24px;
  padding: 36px 0;
  color: var(--muted);
  font-size: 14px;
  letter-spacing: 1px;
  text-align: center;
}

@media (max-width: 640px) {
  .app-title {
    font-size: 27px;
    letter-spacing: 2px;
  }
}
</style>
