import { isToday, isYesterday, format } from 'date-fns'

/**
 * Định dạng thời gian hiển thị trong danh sách hội thoại theo chuẩn Telegram
 * - Cùng ngày: 'HH:mm' (ví dụ: '10:30')
 * - Hôm qua: 'Hôm qua'
 * - Cũ hơn: 'dd/MM' (ví dụ: '24/10')
 */
export function formatConversationTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return ''

  if (isToday(date)) {
    return format(date, 'HH:mm')
  }

  if (isYesterday(date)) {
    return 'Hôm qua'
  }

  return format(date, 'dd/MM')
}
