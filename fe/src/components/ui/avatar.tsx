import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

const AvatarRoot = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    size?: 'sm' | 'default' | 'lg' | 'xl'
  }
>(({ className, size = 'default', ...props }, ref) => {
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    default: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  }[size]

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full font-medium',
        sizeClasses,
        className
      )}
      {...props}
    />
  )
})
AvatarRoot.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn('aspect-square h-full w-full object-cover', className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'flex h-full w-full items-center justify-center rounded-full bg-brand-soft text-brand font-semibold select-none dark:bg-surface-dark-2 dark:text-brand-accent',
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

/**
 * Presence badge (Online green dot with 2px cutout border)
 */
interface PresenceDotProps {
  isOnline?: boolean
  className?: string
}

function PresenceDot({ isOnline = false, className }: PresenceDotProps) {
  return (
    <span
      className={cn(
        'absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-surface-light dark:ring-surface-dark',
        isOnline ? 'bg-presence-online' : 'bg-presence-offline',
        className
      )}
      title={isOnline ? 'Đang trực tuyến' : 'Ngoại tuyến'}
    />
  )
}

export { AvatarRoot as Avatar, AvatarImage, AvatarFallback, PresenceDot }
