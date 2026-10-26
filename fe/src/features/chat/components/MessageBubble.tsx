import { Check, CheckCheck } from 'lucide-react'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Message } from '../types/message.types'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  isOutgoing: boolean
  isGroup?: boolean
  showSenderName?: boolean
  showAvatar?: boolean
  isRead?: boolean
}

/**
 * MessageBubble: Bong bóng tin nhắn Telegram chuẩn thiết kế
 * - Tin gửi đi: nền #EFFDDE (dark: #2B5278), đuôi nhọn ở góc dưới phải (rounded-br-xs)
 * - Tin nhận đến: nền #FFFFFF (dark: #182533), đuôi nhọn ở góc dưới trái (rounded-bl-xs) kèm Avatar người gửi
 * - Flex wrap inline meta: tin nhắn ngắn có thời gian và dấu tích nằm cùng hàng với nội dung
 * - Dấu tích phân biệt: 1 tích xám (Đã gửi) vs 2 tích xanh (Đã đọc)
 */
export function MessageBubble({
  message,
  isOutgoing,
  isGroup = false,
  showSenderName = false,
  showAvatar = true,
  isRead = false,
}: MessageBubbleProps) {
  const timeString = (() => {
    try {
      const d = new Date(message.createdAt)
      return isNaN(d.getTime()) ? '' : format(d, 'HH:mm')
    } catch {
      return ''
    }
  })()

  const initials =
    (message.sender?.displayName || message.sender?.username || 'U')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  return (
    <div
      className={cn(
        'flex w-full mb-1 items-end group select-text',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
      data-testid={`message-bubble-${message.id}`}
    >
      {/* Avatar người gửi cho tin nhắn đến (Incoming) */}
      {!isOutgoing && (
        <div className="w-8 shrink-0 mr-2 self-end mb-0.5 select-none">
          {showAvatar ? (
            <Avatar className="w-8 h-8 rounded-full border border-border-light/50 dark:border-white/10 shadow-xs">
              <AvatarImage
                src={message.sender?.avatarUrl || undefined}
                alt={message.sender?.displayName || message.sender?.username}
              />
              <AvatarFallback className="bg-brand-soft text-brand font-medium text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-8 h-8" aria-hidden="true" />
          )}
        </div>
      )}

      {/* Thân bong bóng tin nhắn */}
      <div
        className={cn(
          'max-w-[85%] sm:max-w-[70%] px-3.5 py-2 shadow-subtle relative border border-black/5 dark:border-white/5 transition-colors',
          isOutgoing
            ? 'bg-bubble-out dark:bg-bubble-out-dark rounded-2xl rounded-br-xs text-ink-primary dark:text-white'
            : 'bg-bubble-in dark:bg-bubble-in-dark rounded-2xl rounded-bl-xs text-ink-primary dark:text-[#F5F5F7]'
        )}
      >
        {/* Tên người gửi trong Group Chat */}
        {!isOutgoing && isGroup && showSenderName && message.sender && (
          <div className="text-xs font-semibold text-brand dark:text-brand-accent mb-1 select-none">
            {message.sender.displayName || message.sender.username}
          </div>
        )}

        {/* Nội dung tin nhắn & Ảnh đính kèm */}
        {message.isRecalled ? (
          <p className="italic text-ink-muted text-sm select-none">
            [Tin nhắn đã bị thu hồi]
          </p>
        ) : (
          <div>
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

            {/* Layout Telegram Inline: chữ và thời gian cùng hàng nếu chữ ngắn */}
            <div className="flex flex-wrap items-end gap-x-2.5 gap-y-1">
              {message.content && (
                <div className="flex-1 min-w-[40px] text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}

              {/* Thời gian và Trạng thái đã đọc */}
              <div className="inline-flex items-center gap-1 select-none text-[11px] text-ink-secondary dark:text-ink-secondary-dark ml-auto shrink-0 leading-none pb-0.5">
                {timeString && <span>{timeString}</span>}
                {isOutgoing && (
                  <span
                    className="inline-flex items-center"
                    aria-label={isRead ? 'Đã đọc' : 'Đã gửi'}
                  >
                    {isRead ? (
                      <CheckCheck className="w-3.5 h-3.5 text-[#4FAE4E] dark:text-[#5288C1]" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-ink-muted dark:text-ink-secondary-dark" />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
