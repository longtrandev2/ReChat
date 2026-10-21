import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Standard utility to conditionally merge Tailwind CSS classes safely without conflicts.
 * Example: cn('px-4 py-2 bg-brand', isOutlined && 'border border-brand bg-transparent', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
