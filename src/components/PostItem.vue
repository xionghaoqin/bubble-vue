<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '@/types/post'
import { formatRelativeTime } from '@/utils/time'
import { hueFromId } from '@/utils/id'

const props = withDefaults(
  defineProps<{ post: Post; liking?: boolean; favoriting?: boolean }>(),
  { liking: false, favoriting: false }
)

const emit = defineEmits<{ remove: [id: string]; like: [id: string]; favorite: [id: string] }>()

const hue = computed(() => hueFromId(props.post.id))
const timeText = computed(() => formatRelativeTime(props.post.createdAt))
const cardStyle = computed(() => ({ '--hue': String(hue.value) }))
</script>

<template>
  <li class="post" data-testid="post-item" :style="cardStyle">
    <p class="post-content" data-testid="post-content">{{ post.content }}</p>
    <div class="post-meta">
      <time class="post-time" data-testid="post-time">{{ timeText }}</time>
      <div class="post-actions">
        <button
          class="reaction reaction-like"
          :class="{ 'is-active': post.liked, 'is-pending': liking }"
          data-testid="post-like"
          type="button"
          :aria-pressed="post.liked ? 'true' : 'false'"
          :aria-label="post.liked ? '取消点赞' : '点赞'"
          :disabled="liking"
          @click="emit('like', post.id)"
        >
          <span class="reaction-icon" aria-hidden="true">♥</span>
          <span class="reaction-count" data-testid="post-like-count">{{ post.likeCount }}</span>
        </button>
        <button
          class="reaction reaction-favorite"
          :class="{ 'is-active': post.favorited, 'is-pending': favoriting }"
          data-testid="post-favorite"
          type="button"
          :aria-pressed="post.favorited ? 'true' : 'false'"
          :aria-label="post.favorited ? '取消收藏' : '收藏'"
          :disabled="favoriting"
          @click="emit('favorite', post.id)"
        >
          <span class="reaction-icon" aria-hidden="true">★</span>
          <span class="reaction-count" data-testid="post-favorite-count">{{
            post.favoriteCount
          }}</span>
        </button>
        <button
          class="post-delete"
          data-testid="post-delete"
          type="button"
          aria-label="删除这条内容"
          @click="emit('remove', post.id)"
        >
          删除
        </button>
      </div>
    </div>
  </li>
</template>

<style scoped>
.post {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
  padding: 16px 18px 14px 22px;
  border: 1px solid var(--stroke);
  border-radius: var(--radius-md);
  background: var(--glass);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  transition: transform 0.35s var(--ease), border-color 0.35s ease, box-shadow 0.35s var(--ease),
    background 0.35s ease;
  animation: pop-in 0.35s var(--ease) both;
}

/* 左侧彩条：色相由内容 id 派生，形成稳定的多彩层次 */
.post::before {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 3px;
  border-radius: 999px;
  background: linear-gradient(
    180deg,
    hsl(var(--hue, 268) 95% 68%),
    hsl(calc(var(--hue, 268) + 70) 95% 62%)
  );
  box-shadow: 0 0 14px hsl(var(--hue, 268) 95% 62% / 0.85);
  content: '';
}

.post:hover {
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.075);
  box-shadow: 0 20px 44px rgba(0, 0, 0, 0.5), 0 0 34px hsl(var(--hue, 268) 95% 62% / 0.22);
  transform: translateY(-3px);
}

.post-content {
  color: #eef0ff;
  font-size: 15.5px;
  line-height: 1.8;
  overflow-wrap: break-word;
  white-space: pre-wrap;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  justify-content: space-between;
}

.post-time {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.post-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-left: auto;
}

/* --- 互动按钮：图标 + 数字，宽度稳定不换行 --- */
.reaction {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.25s ease,
    opacity 0.2s ease;
}

.reaction-icon {
  font-size: 13px;
  line-height: 1;
}

.reaction-count {
  min-width: 1ch;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.2px;
}

.reaction:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

/* 已点赞：粉红霓虹光晕 */
.reaction-like.is-active {
  border-color: rgba(244, 114, 182, 0.55);
  background: rgba(244, 114, 182, 0.16);
  box-shadow: 0 0 16px rgba(244, 114, 182, 0.45);
  color: #f472b6;
}

/* 已收藏：琥珀霓虹光晕 */
.reaction-favorite.is-active {
  border-color: rgba(251, 191, 36, 0.55);
  background: rgba(251, 191, 36, 0.16);
  box-shadow: 0 0 16px rgba(251, 191, 36, 0.45);
  color: #fbbf24;
}

.reaction.is-active .reaction-icon {
  filter: drop-shadow(0 0 6px currentColor);
}

/* 请求进行中：降透明度 + 禁用光标，避免重复提交 */
.reaction:disabled,
.reaction.is-pending {
  opacity: 0.45;
  cursor: not-allowed;
}

.post-delete {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  opacity: 0.75;
  cursor: pointer;
  transition: color 0.2s ease, background 0.2s ease, opacity 0.2s ease, box-shadow 0.25s ease;
}

.post-delete:hover {
  border-color: rgba(255, 93, 115, 0.55);
  background: rgba(255, 93, 115, 0.18);
  box-shadow: 0 0 18px rgba(255, 93, 115, 0.35);
  color: #fff;
  opacity: 1;
}
</style>
