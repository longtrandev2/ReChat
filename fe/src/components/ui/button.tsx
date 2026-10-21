import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Stitch Design System Button Component
 * Supports primary Lagoon Teal, Coral destructive/alert, secondary, and ghost variants.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-brand text-white shadow-subtle hover:bg-brand-dark active:bg-brand-dark',
        destructive:
          'bg-coral text-white shadow-subtle hover:bg-coral/90 active:bg-coral/95',
        outline:
          'border border-border-light bg-surface-light text-ink-primary hover:bg-surface-light-2 dark:border-border-dark dark:bg-surface-dark dark:text-ink-primary-dark dark:hover:bg-surface-dark-2',
        secondary:
          'bg-surface-light-2 text-ink-primary hover:bg-border-light dark:bg-surface-dark-2 dark:text-ink-primary-dark dark:hover:bg-border-dark',
        ghost:
          'text-ink-secondary hover:bg-surface-light-2 hover:text-ink-primary dark:text-ink-secondary-dark dark:hover:bg-surface-dark-2 dark:hover:text-ink-primary-dark',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
