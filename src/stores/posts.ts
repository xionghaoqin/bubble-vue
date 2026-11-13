import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { MAX_CONTENT_LENGTH, type AddPostResult, type Post } from '@/types/post'
import { readPosts, writePosts } from '@/utils/storage'
import { createPostId } from '@/utils/id'

export const usePostsStore = defineStore('posts', () => {
  // --- state ---
  const posts = ref<Post[]>(readPosts())

  // --- getters（派生数据，不在模板里重复计算）---
  const sortedPosts = computed(() => [...posts.value].sort((a, b) => b.createdAt - a.createdAt))
  const total = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

  // --- actions ---
  function addPost(content: string): AddPostResult {
    const text = String(content ?? '').trim()

    if (!text) {
      return { ok: false, reason: 'empty', message: '内容不能为空' }
    }
    if (text.length > MAX_CONTENT_LENGTH) {
      return {
        ok: false,
        reason: 'too-long',
        message: `内容不能超过 ${MAX_CONTENT_LENGTH} 字`,
      }
    }

    const post: Post = { id: createPostId(), content: text, createdAt: Date.now() }
    posts.value = [...posts.value, post]
    writePosts(posts.value)

    return { ok: true, post }
  }

  function removePost(id: string): void {
    posts.value = posts.value.filter((post) => post.id !== id)
    writePosts(posts.value)
  }

  function reload(): void {
    posts.value = readPosts()
  }

  return { posts, sortedPosts, total, isEmpty, addPost, removePost, reload }
})
