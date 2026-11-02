import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

/**
 * Telegram-Style High-Polish Input Component
 * Crisp 1px border, smooth focus-ring, comfortable 44px-48px touch target.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 sm:h-12 w-full rounded-xl border border-border-light bg-surface-light px-3.5 py-2.5 text-sm sm:text-base text-ink-primary shadow-subtle transition-all duration-150 placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-ink-primary-dark dark:placeholder:text-ink-muted dark:focus-visible:border-brand-accent dark:focus-visible:ring-brand/30',
          error && 'border-coral focus-visible:border-coral focus-visible:ring-coral/20',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
