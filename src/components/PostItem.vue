<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '@/types/post'
import { formatRelativeTime } from '@/utils/time'
import { hueFromId } from '@/utils/id'

const props = defineProps<{ post: Post }>()

const emit = defineEmits<{ remove: [id: string] }>()

const hue = computed(() => hueFromId(props.post.id))
const timeText = computed(() => formatRelativeTime(props.post.createdAt))
const cardStyle = computed(() => ({ '--hue': String(hue.value) }))
</script>

<template>
  <li class="post" data-testid="post-item" :style="cardStyle">
    <p class="post-content" data-testid="post-content">{{ post.content }}</p>
    <div class="post-meta">
      <time class="post-time" data-testid="post-time">{{ timeText }}</time>
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
  align-items: center;
  justify-content: space-between;
}

.post-time {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.post-delete {
  padding: 4px 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--muted);
  font: inherit;
  font-size: 12px;
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
