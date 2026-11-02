import { Ban, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { BlockStatus } from '@/features/conversations/types/conversation.types'

interface BlockedComposerBarProps {
  blockStatus: Exclude<BlockStatus, 'NONE'>
  isUnblocking?: boolean
  onUnblock: () => void
}

/**
 * BlockedComposerBar: Thay thế khung soạn tin khi hội thoại DIRECT bị chặn (BR-38)
 * - BLOCKED_BY_ME: banner + nút "Bỏ chặn"
 * - BLOCKED_ME: thanh khóa, không có hành động
 */
export function BlockedComposerBar({ blockStatus, isUnblocking = false, onUnblock }: BlockedComposerBarProps) {
  const blockedByMe = blockStatus === 'BLOCKED_BY_ME'

  return (
    <div
      className="p-3 md:pb-4 max-w-3xl mx-auto w-full shrink-0 z-10 select-none"
      data-testid={blockedByMe ? 'blocked-by-me-bar' : 'blocked-me-bar'}
      role="status"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-surface-light dark:bg-[#17212B] border border-border-light dark:border-border-dark text-sm shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0 text-ink-secondary dark:text-ink-secondary-dark">
          <Ban className="w-4 h-4 shrink-0 text-coral" />
          <span className="truncate">
            {blockedByMe ? 'Bạn đã chặn người dùng này' : 'Bạn không thể gửi tin nhắn cho người này'}
          </span>
        </div>
        {blockedByMe && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onUnblock}
            disabled={isUnblocking}
            className="rounded-xl text-xs shrink-0 flex items-center gap-1.5"
            data-testid="unblock-button"
          >
            {isUnblocking && <Loader2 className="w-3 h-3 animate-spin" />}
            Bỏ chặn
          </Button>
        )}
      </div>
    </div>
  )
}
