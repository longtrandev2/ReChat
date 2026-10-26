import { describe, it, expect } from 'vitest'
import {
  formatDateDivider,
  isDifferentDay,
  formatMessageTime,
} from './format-message'

describe('format-message Utility Tests', () => {
  describe('formatDateDivider', () => {
    it('returns "Hôm nay" for today', () => {
      expect(formatDateDivider(new Date())).toBe('Hôm nay')
    })

    it('returns "Hôm qua" for yesterday', () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      expect(formatDateDivider(yesterday)).toBe('Hôm qua')
    })

    it('returns empty string for invalid date', () => {
      expect(formatDateDivider('xyz-not-a-date')).toBe('')
    })
  })

  describe('isDifferentDay', () => {
    it('returns true if previous date is undefined', () => {
      expect(isDifferentDay('2026-10-26T10:00:00.000Z', undefined)).toBe(true)
    })

    it('returns true for different calendar days', () => {
      expect(
        isDifferentDay('2026-10-26T10:00:00.000Z', '2026-10-24T10:00:00.000Z')
      ).toBe(true)
    })

    it('returns false for the same calendar day', () => {
      expect(
        isDifferentDay('2026-10-26T10:00:00.000Z', '2026-10-26T15:30:00.000Z')
      ).toBe(false)
    })

    it('returns false if dates are invalid', () => {
      expect(isDifferentDay('invalid', 'not-a-date')).toBe(false)
    })
  })

  describe('formatMessageTime', () => {
    it('formats valid ISO date into HH:mm', () => {
      const testDate = new Date(2026, 9, 26, 14, 35)
      expect(formatMessageTime(testDate)).toBe('14:35')
    })

    it('returns empty string for invalid input', () => {
      expect(formatMessageTime('xyz-not-a-date')).toBe('')
    })
  })
})
