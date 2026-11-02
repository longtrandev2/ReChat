import { Loader2 } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Trả true khi thành công để dialog tự đóng */
  onConfirm: () => Promise<boolean>
  isLoading?: boolean
}

const OVERLAY_CLASS =
  'fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-150'
const CONTENT_CLASS =
  'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#17212B] text-ink-primary dark:text-white border border-border dark:border-white/10 p-5 rounded-2xl shadow-2xl z-50 animate-in zoom-in-95 duration-150 focus:outline-none'

interface ConfirmShellProps extends ConfirmDialogBaseProps {
  title: string
  description: React.ReactNode
  confirmLabel: string
  testId: string
}

/** Khung dialog xác nhận chung (Radix Dialog) dùng cho Xóa đoạn chat & Chặn người dùng */
function ConfirmShell({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
  title,
  description,
  confirmLabel,
  testId,
}: ConfirmShellProps) {
  const handleConfirm = async () => {
    const ok = await onConfirm()
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={OVERLAY_CLASS} />
        <Dialog.Content className={CONTENT_CLASS}>
          <Dialog.Title className="text-base font-bold text-ink-primary dark:text-white">
            {title}
          </Dialog.Title>
          <Dialog.Description className="text-xs text-ink-muted mt-2 leading-relaxed">
            {description}
          </Dialog.Description>
          <div className="flex items-center justify-end gap-2 mt-5">
            <Dialog.Close asChild>
              <Button variant="ghost" disabled={isLoading}>
                Hủy
              </Button>
            </Dialog.Close>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-coral hover:bg-coral/90 text-white cursor-pointer flex items-center gap-1.5"
              data-testid={testId}
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Xác nhận chặn người dùng (BR-28, BR-38) */
export function BlockUserConfirmDialog({
  name,
  ...props
}: ConfirmDialogBaseProps & { name: string }) {
  return (
    <ConfirmShell
      {...props}
      title="Chặn người dùng này?"
      confirmLabel="Chặn"
      testId="confirm-block-user-submit"
      description={
        <>
          Bạn và <strong className="text-ink-primary dark:text-white">{name}</strong> sẽ không thể
          nhắn tin cho nhau, và đối phương không còn thấy trạng thái hoạt động của bạn.
        </>
      }
    />
  )
}

/** Xác nhận xóa lịch sử đoạn chat phía người dùng hiện tại (FR-48) */
export function ClearHistoryConfirmDialog(props: ConfirmDialogBaseProps) {
  return (
    <ConfirmShell
      {...props}
      title="Xóa đoạn chat?"
      confirmLabel="Xóa đoạn chat"
      testId="confirm-clear-history-submit"
      description="Toàn bộ tin nhắn sẽ bị xóa khỏi tài khoản của bạn. Người còn lại vẫn giữ nguyên lịch sử. Đoạn chat sẽ xuất hiện lại khi có tin nhắn mới."
    />
  )
}
