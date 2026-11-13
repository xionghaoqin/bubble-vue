import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import App from '@/App.vue'
import { STORAGE_KEY, type Post } from '@/types/post'

function mountApp() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(App, { global: { plugins: [pinia] } })
}

function readStorage(): Post[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Post[]
}

async function publish(wrapper: ReturnType<typeof mountApp>, text: string) {
  await wrapper.find('[data-testid="composer-input"]').setValue(text)
  await wrapper.find('[data-testid="composer-submit"]').trigger('click')
}

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始为空状态', () => {
    const wrapper = mountApp()

    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('发布后列表立即出现该条且写入本地存储', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '第一条泡泡')

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('第一条泡泡')
    expect(readStorage()[0]?.content).toBe('第一条泡泡')
  })

  it('发布成功后清空输入框与字数统计', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '清空测试')

    expect((wrapper.find('[data-testid="composer-input"]').element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find('[data-testid="composer-counter"]').text()).toBe('0/280')
  })

  it('纯空白内容被拦截并提示，不产生内容', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '    ')

    expect(wrapper.find('[data-testid="composer-error"]').text()).toBe('内容不能为空')
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(readStorage()).toHaveLength(0)
  })

  it('超过 280 字被拦截并提示', async () => {
    const wrapper = mountApp()

    await publish(wrapper, 'a'.repeat(281))

    expect(wrapper.find('[data-testid="composer-error"]').text()).toBe('内容不能超过 280 字')
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
  })

  it('再次成功发布后错误提示消失', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '   ')
    expect(wrapper.find('[data-testid="composer-error"]').exists()).toBe(true)

    await publish(wrapper, '正常内容')

    expect(wrapper.find('[data-testid="composer-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(1)
  })

  it('列表按时间倒序展示已存储内容', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'old', content: '旧内容', createdAt: 1000 },
        { id: 'new', content: '新内容', createdAt: 2000 },
      ])
    )

    const wrapper = mountApp()
    const items = wrapper.findAll('[data-testid="post-item"]')

    expect(items[0]?.text()).toContain('新内容')
    expect(items[1]?.text()).toContain('旧内容')
  })

  it('点击删除后列表与存储同步移除', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'only', content: '要删掉的', createdAt: 1000 }])
    )
    const wrapper = mountApp()

    await wrapper.find('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.findAll('[data-testid="post-item"]')).toHaveLength(0)
    expect(readStorage()).toHaveLength(0)
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(true)
  })
})
