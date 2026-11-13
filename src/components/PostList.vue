<script setup lang="ts">
import PostItem from '@/components/PostItem.vue'
import type { Post } from '@/types/post'

defineProps<{ posts: Post[] }>()

const emit = defineEmits<{ remove: [id: string] }>()
</script>

<template>
  <section class="feed-section" aria-label="内容列表">
    <ul v-if="posts.length > 0" class="feed" data-testid="feed">
      <PostItem
        v-for="post in posts"
        :key="post.id"
        :post="post"
        @remove="emit('remove', $event)"
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
