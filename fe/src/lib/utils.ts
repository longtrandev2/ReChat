import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Standard utility to conditionally merge Tailwind CSS classes safely without conflicts.
 * Example: cn('px-4 py-2 bg-brand', isOutlined && 'border border-brand bg-transparent', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Chuyển đổi dung lượng byte sang định dạng người dùng đọc được (B, KB, MB, GB).
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || bytes <= 0 || isNaN(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

