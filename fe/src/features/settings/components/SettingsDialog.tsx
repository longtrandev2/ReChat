import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  icon?: ReactNode
  /** danger: tông đỏ cho hành động phá hủy (tắt 2FA, đăng xuất thiết bị) */
  tone?: 'brand' | 'danger'
  children: ReactNode
  testId?: string
}

/**
 * SettingsDialog: khung Radix Dialog dùng chung cho Bật/Tắt 2FA và xác nhận đăng xuất thiết bị.
 * Nội dung chỉ mount khi mở => state bên trong (OTP, countdown, mật khẩu) tự reset mỗi lần mở.
 */
export function SettingsDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  tone = 'brand',
  children,
  testId,
}: SettingsDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-white dark:bg-[#17212B] rounded-2xl p-6 shadow-2xl border border-border dark:border-border-dark animate-in fade-in zoom-in-95 duration-150"
          data-testid={testId}
        >
          <div className="flex items-center gap-3 mb-3">
            {icon && (
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                  tone === 'danger'
                    ? 'bg-coral-soft dark:bg-rose-950/40 text-coral dark:text-rose-400'
                    : 'bg-brand-soft dark:bg-brand/15 text-brand dark:text-brand-accent'
                )}
              >
                {icon}
              </div>
            )}
            <Dialog.Title className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">
              {title}
            </Dialog.Title>
          </div>

          {description ? (
            <Dialog.Description className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark leading-relaxed mb-5">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}

          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
