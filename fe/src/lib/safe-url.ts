import { toast } from 'sonner'

/**
 * Chỉ cho phép giao thức http/https (chặn javascript:, data:, file:... - chống XSS qua fileUrl)
 */
export function isSafeHttpUrl(url: string | null | undefined): url is string {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Mở URL ở tab mới nếu hợp lệ (http/https); ngược lại hiển thị toast và không làm gì.
 * noopener,noreferrer ngăn trang đích truy cập window.opener.
 */
export function openSafeUrl(url: string | null | undefined): boolean {
  if (!isSafeHttpUrl(url)) {
    toast.error('Liên kết tệp không hợp lệ')
    return false
  }
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
