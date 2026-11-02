import { Pin, X, Layers } from 'lucide-react'
import type { Message } from '../types/message.types'

export interface PinnedMessageBarProps {
  pinnedMessages: Message[]
  onJumpToMessage: (messageId: string) => void
  onUnpin: (message: Message) => void
  onOpenPinnedList?: () => void
}

/**
 * PinnedMessageBar: Thanh hiển thị tin nhắn ghim cố định ở đỉnh cuộc hội thoại (Telegram / Messenger style)
 * - Vạch chỉ thị màu xanh thương hiệu (#2481CC) kèm icon Pin xoay
 * - Hiển thị tên người gửi và tóm tắt nội dung (chữ / hình ảnh / tệp tin)
 * - Bấm vào thanh để cuộn mượt đến vị trí tin nhắn gốc trong feed kèm hiệu ứng glow
 * - Nút xem danh sách toàn bộ tin ghim (khi có nhiều hơn 1 tin) và nút Bỏ ghim nhanh
 */
export function PinnedMessageBar({
  pinnedMessages,
  onJumpToMessage,
  onUnpin,
  onOpenPinnedList,
}: PinnedMessageBarProps) {
  if (!pinnedMessages || pinnedMessages.length === 0) {
    return null
  }

  const latest = pinnedMessages[0]
  const senderName =
    latest.sender?.displayName || latest.sender?.username || 'Người dùng'

  const snippet = (() => {
    if (latest.type === 'IMAGE') {
      return latest.content ? `[Hình ảnh] ${latest.content}` : '[Hình ảnh]'
    }
    if (latest.type === 'FILE') {
      return latest.content ? `[Tệp tin] ${latest.content}` : '[Tệp tin]'
    }
    return latest.content || 'Tin nhắn'
  })()

  return (
    <div
      className="w-full bg-white/95 dark:bg-[#17212B]/95 backdrop-blur-md border-b border-border-light dark:border-border-dark px-3 py-1.5 flex items-center justify-between gap-2.5 z-20 shadow-2xs select-none transition-colors"
      data-testid="pinned-message-bar"
    >
      {/* Vạch chỉ thị dọc màu xanh Telegram */}
      <div className="w-[3px] self-stretch min-h-[32px] bg-brand rounded-full shrink-0" />

      {/* Nội dung tin ghim có thể click để cuộn tới tin nhắn */}
      <button
        type="button"
        onClick={() => onJumpToMessage(latest.id)}
        className="flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer group hover:opacity-90 transition-opacity"
        data-testid="pinned-bar-jump-button"
        title="Bấm để cuộn đến tin nhắn đã ghim"
      >
        <Pin className="w-3.5 h-3.5 text-brand fill-brand shrink-0 rotate-45" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
              Tin nhắn đã ghim
            </span>
            {pinnedMessages.length > 1 && (
              <span
                className="text-[10px] font-medium text-ink-muted bg-brand/10 text-brand px-1.5 py-0.2 rounded-full"
                data-testid="pinned-count-badge"
              >
                {pinnedMessages.length} tin
              </span>
            )}
          </div>

          <p className="text-xs truncate text-ink-secondary dark:text-ink-secondary-dark mt-0.5 leading-tight">
            <span className="font-semibold text-ink-primary dark:text-ink-primary-dark mr-1">
              {senderName}:
            </span>
            <span>{snippet}</span>
          </p>
        </div>
      </button>

      {/* Hành động bên phải: Xem danh sách & Bỏ ghim */}
      <div className="flex items-center gap-1 shrink-0">
        {pinnedMessages.length > 1 && onOpenPinnedList && (
          <button
            type="button"
            onClick={onOpenPinnedList}
            className="p-1.5 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-brand hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Xem danh sách tin nhắn đã ghim"
            aria-label="Xem danh sách tin nhắn đã ghim"
            data-testid="open-pinned-list-button"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onUnpin(latest)
          }}
          className="p-1.5 rounded-full text-ink-secondary dark:text-ink-secondary-dark hover:text-coral hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          title="Bỏ ghim tin nhắn này"
          aria-label="Bỏ ghim tin nhắn"
          data-testid="unpin-current-button"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
