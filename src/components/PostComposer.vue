<script setup lang="ts">
import { computed } from 'vue'
import { MAX_CONTENT_LENGTH } from '@/types/post'

const props = withDefaults(
  defineProps<{
    modelValue: string
    maxLength?: number
    error?: string | null
  }>(),
  {
    maxLength: MAX_CONTENT_LENGTH,
    error: null,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
}>()

const length = computed(() => props.modelValue.length)
const counterText = computed(() => `${length.value}/${props.maxLength}`)

const counterClasses = computed(() => ({
  'composer-counter': true,
  'is-warn': length.value >= props.maxLength - 40 && length.value <= props.maxLength,
  'is-over': length.value > props.maxLength,
}))

function handleInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <section class="composer" aria-label="发布内容">
    <textarea
      class="composer-input"
      data-testid="composer-input"
      :value="modelValue"
      :maxlength="maxLength"
      rows="3"
      placeholder="说点什么吧…"
      @input="handleInput"
    ></textarea>

    <p v-if="error" class="composer-error" data-testid="composer-error" role="alert">
      {{ error }}
    </p>

    <div class="composer-footer">
      <span :class="counterClasses" data-testid="composer-counter">{{ counterText }}</span>
      <button class="composer-submit" data-testid="composer-submit" type="button" @click="emit('submit')">
        发布
      </button>
    </div>
  </section>
</template>

<style scoped>
.composer {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 18px 16px;
  border: 1px solid var(--stroke);
  border-radius: var(--radius-lg);
  background: var(--glass);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  transition: box-shadow 0.4s var(--ease);
}

/* 渐变描边 */
.composer::before {
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(
    135deg,
    rgba(34, 211, 238, 0.7),
    rgba(139, 92, 246, 0.75) 40%,
    rgba(244, 114, 182, 0.6) 75%,
    rgba(251, 191, 36, 0.55)
  );
  content: '';
  opacity: 0.85;
  pointer-events: none;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
}

.composer:focus-within {
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55), 0 0 40px rgba(139, 92, 246, 0.35);
}

.composer-input {
  width: 100%;
  min-height: 96px;
  padding: 2px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  line-height: 1.75;
  resize: vertical;
}

.composer-input::placeholder {
  color: #6f769b;
  -webkit-text-fill-color: #6f769b;
}

/* 输入文字自带流动炫彩渐变 */
@supports ((-webkit-background-clip: text) or (background-clip: text)) {
  .composer-input {
    background-image: linear-gradient(
      90deg,
      #22d3ee,
      #8b5cf6 28%,
      #f472b6 55%,
      #fbbf24 78%,
      #22d3ee
    );
    background-size: 300% 100%;
    color: transparent;
    caret-color: var(--cyan);
    animation: hueflow 10s linear infinite;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.composer-error {
  margin: -4px 0 0;
  color: var(--danger);
  font-size: 13px;
  letter-spacing: 0.5px;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.composer-counter {
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
  transition: color 0.25s ease;
}

.composer-counter.is-warn {
  color: var(--amber);
}

.composer-counter.is-over {
  color: var(--danger);
}

.composer-submit {
  position: relative;
  overflow: hidden;
  padding: 10px 28px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(120deg, #22d3ee, #8b5cf6 55%, #f472b6);
  box-shadow: 0 10px 26px rgba(139, 92, 246, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.45);
  color: #0a0a14;
  font: inherit;
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  transition: transform 0.2s var(--ease), box-shadow 0.3s var(--ease), filter 0.3s ease;
}

.composer-submit::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
  content: '';
  transform: translateX(-130%);
  transition: transform 0.7s var(--ease);
}

.composer-submit:hover {
  box-shadow: 0 14px 38px rgba(34, 211, 238, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.2);
  filter: brightness(1.08);
  transform: translateY(-2px) scale(1.02);
}

.composer-submit:hover::after {
  transform: translateX(130%);
}

.composer-submit:active {
  transform: scale(0.96);
}

@media (max-width: 640px) {
  .composer {
    padding: 14px;
  }

  .composer-submit {
    padding: 9px 22px;
  }
}
</style>
