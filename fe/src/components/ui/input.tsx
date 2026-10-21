import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

/**
 * Stitch Design System Input Component
 * Crisp 1px border, focused brand ring without outer glow rings.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-border-light bg-surface-light px-3 py-1 text-sm text-ink-primary shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-dark dark:bg-surface-dark dark:text-ink-primary-dark dark:placeholder:text-ink-muted dark:focus-visible:border-brand-accent dark:focus-visible:ring-brand-accent',
          error && 'border-coral focus-visible:border-coral focus-visible:ring-coral',
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
