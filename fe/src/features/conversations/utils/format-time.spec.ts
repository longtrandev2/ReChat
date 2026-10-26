import { describe, it, expect } from 'vitest'
import { formatConversationTime } from './format-time'

describe('formatConversationTime Tests', () => {
  it('returns empty string for null, undefined, or invalid dates', () => {
    expect(formatConversationTime(null)).toBe('')
    expect(formatConversationTime(undefined)).toBe('')
    expect(formatConversationTime('invalid-date')).toBe('')
  })

  it('formats today date as HH:mm', () => {
    const today = new Date()
    today.setHours(14, 25, 0, 0)
    expect(formatConversationTime(today)).toBe('14:25')
  })

  it('formats yesterday date as "Hôm qua"', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatConversationTime(yesterday)).toBe('Hôm qua')
  })

  it('formats older date as dd/MM', () => {
    const olderDate = new Date('2026-05-15T10:00:00.000Z')
    expect(formatConversationTime(olderDate)).toBe('15/05')
  })
})
