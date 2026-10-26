import { Check, CheckCheck } from 'lucide-react'
import { format } from 'date-fns'
import type { Message } from '../types/message.types'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  isOutgoing: boolean
  isGroup?: boolean
  showSenderName?: boolean
  isRead?: boolean
}

/**
 * MessageBubble: Bong bóng tin nhắn theo phong cách Telegram Web
 * - Tin gửi đi (Outgoing): nền xanh nhạt #EFFDDE (dark: #2B5278), góc bo tr-xs
 * - Tin nhận đến (Incoming): nền trắng #FFFFFF (dark: #182533), góc bo tl-xs
 * - Dấu tích trạng thái gửi/đã đọc (Single Check / Double Check)
 * - Xử lý tin nhắn thu hồi, ảnh đính kèm và văn bản thông thường
 */
export function MessageBubble({
  message,
  isOutgoing,
  isGroup = false,
  showSenderName = false,
  isRead = true,
}: MessageBubbleProps) {
  const timeString = (() => {
    try {
      const d = new Date(message.createdAt)
      return isNaN(d.getTime()) ? '' : format(d, 'HH:mm')
    } catch {
      return ''
    }
  })()

  return (
    <div
      className={cn(
        'flex w-full mb-1.5 transition-all',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
      data-testid={`message-bubble-${message.id}`}
    >
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[70%] px-3.5 py-2 shadow-subtle relative text-ink-primary dark:text-ink-primary-dark',
          isOutgoing
            ? 'bg-bubble-out dark:bg-bubble-out-dark rounded-2xl rounded-tr-xs'
            : 'bg-bubble-in dark:bg-bubble-in-dark rounded-2xl rounded-tl-xs'
        )}
      >
        {/* Tên người gửi trong Group Chat (chỉ hiển thị với tin nhắn nhận) */}
        {!isOutgoing && isGroup && showSenderName && message.sender && (
          <div className="text-xs font-semibold text-brand dark:text-brand-accent mb-1 select-none">
            {message.sender.displayName || message.sender.username}
          </div>
        )}

        {/* Nội dung tin nhắn */}
        {message.isRecalled ? (
          <p className="italic text-ink-muted text-sm select-none">
            [Tin nhắn đã bị thu hồi]
          </p>
        ) : (
          <>
            {message.type === 'IMAGE' && message.fileUrl && (
              <div className="rounded-xl overflow-hidden mb-1.5 max-h-72">
                <img
                  src={message.fileUrl}
                  alt="Hình ảnh đính kèm"
                  className="w-full h-full object-cover rounded-xl"
                  loading="lazy"
                />
              </div>
            )}
            {message.content && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </>
        )}

        {/* Thời gian và trạng thái đọc */}
        <div className="flex items-center justify-end gap-1 mt-1 text-[11px] text-ink-secondary dark:text-ink-secondary-dark select-none -mb-0.5 ml-2">
          {timeString && <span>{timeString}</span>}
          {isOutgoing && (
            <span
              className="inline-flex text-brand dark:text-brand-accent"
              aria-label={isRead ? 'Đã đọc' : 'Đã gửi'}
            >
              {isRead ? (
                <CheckCheck className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
