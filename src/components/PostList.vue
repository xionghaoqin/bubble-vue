<script setup lang="ts">
import PostItem from '@/components/PostItem.vue'
import type { Post, ReactionKind } from '@/types/post'

withDefaults(
  defineProps<{
    posts: Post[]
    /** 由 store 提供的在途判断，用于禁用对应按钮 */
    isReacting?: (id: string, kind: ReactionKind) => boolean
  }>(),
  { isReacting: () => false }
)

const emit = defineEmits<{
  remove: [id: string]
  like: [id: string]
  favorite: [id: string]
}>()
</script>

<template>
  <section class="feed-section" aria-label="内容列表">
    <ul v-if="posts.length > 0" class="feed" data-testid="feed">
      <PostItem
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :liking="isReacting(post.id, 'like')"
        :favoriting="isReacting(post.id, 'favorite')"
        @remove="emit('remove', $event)"
        @like="emit('like', $event)"
        @favorite="emit('favorite', $event)"
      />
    </ul>
    <p v-else class="feed-empty" data-testid="feed-empty">还没有内容，来发第一条吧</p>
  </section>
</template>

<style scoped>
.feed-section {
  margin-top: 24px;
}

.feed {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.feed-empty {
  padding: 44px 0;
  color: var(--muted);
  font-size: 14px;
  letter-spacing: 1px;
  text-align: center;
}

.feed-empty::before {
  display: block;
  margin-bottom: 12px;
  content: '🫧';
  font-size: 36px;
  filter: drop-shadow(0 0 16px rgba(34, 211, 238, 0.6));
  animation: bob 3.2s ease-in-out infinite;
}
</style>
