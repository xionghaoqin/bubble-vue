import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/utils/time'

const NOW = new Date(2026, 10, 13, 12, 0, 0).getTime()
const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('一分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(NOW - 30 * SECOND, NOW)).toBe('刚刚')
  })

  it('一小时内显示分钟数', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前')
  })

  it('一天内显示小时数', () => {
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前')
  })

  it('一到两天显示「昨天」', () => {
    expect(formatRelativeTime(NOW - 26 * HOUR, NOW)).toBe('昨天')
  })

  it('一周内显示天数', () => {
    expect(formatRelativeTime(NOW - 5 * DAY, NOW)).toBe('5 天前')
  })

  it('超过一周显示具体日期', () => {
    expect(formatRelativeTime(NOW - 30 * DAY, NOW)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('未来时间也按「刚刚」处理，不出现负数', () => {
    expect(formatRelativeTime(NOW + 10 * SECOND, NOW)).toBe('刚刚')
  })
})
