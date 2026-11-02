import { isToday, isYesterday, isThisYear, format, isSameDay } from 'date-fns'

/**
 * Format nhãn ngày hiển thị trên vạch phân cách ngày theo chuẩn Telegram:
 * - Hôm nay: "Hôm nay"
 * - Hôm qua: "Hôm qua"
 * - Trong năm hiện tại: "d tháng M" (Ví dụ: "14 tháng 10")
 * - Khác năm hiện tại: "d tháng M, yyyy" (Ví dụ: "14 tháng 10, 2025")
 */
export function formatDateDivider(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return ''

  if (isToday(date)) return 'Hôm nay'
  if (isYesterday(date)) return 'Hôm qua'
  if (isThisYear(date)) return `${date.getDate()} tháng ${date.getMonth() + 1}`

  return `${date.getDate()} tháng ${date.getMonth() + 1}, ${date.getFullYear()}`
}

/**
 * Kiểm tra xem 2 mốc thời gian có thuộc các ngày khác nhau không
 */
export function isDifferentDay(dateStr1: string, dateStr2?: string): boolean {
  if (!dateStr2) return true
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false

  return !isSameDay(d1, d2)
}

/**
 * Format thời gian hiển thị trong tin nhắn (HH:mm)
 */
export function formatMessageTime(dateInput: string | Date): string {
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
    return isNaN(d.getTime()) ? '' : format(d, 'HH:mm')
  } catch {
    return ''
  }
}
