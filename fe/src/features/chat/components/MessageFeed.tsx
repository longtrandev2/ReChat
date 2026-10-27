import { useEffect, useRef, useLayoutEffect, useCallback, useMemo, useState } from 'react'
import { Loader2, ChevronDown, MessageSquare } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { DateDivider } from './DateDivider'
import { isDifferentDay } from '../utils/format-message'
import type { Message } from '../types/message.types'

interface MessageFeedProps {
  messages: Message[]
  currentUserId: string
  isGroup?: boolean
  isLoadingOlder?: boolean
  hasMore?: boolean
  lastReadMessageId?: string
  typingUserNames?: string[]
  onLoadMore?: () => void
  onReact?: (message: Message, emoji: string) => void
  onReply?: (message: Message) => void
  onEdit?: (message: Message) => void
  onRecall?: (message: Message) => void
  onScrollToReply?: (replyToId: string) => void
  onImageClick?: (imageUrl: string, altText?: string) => void
}

/**
 * MessageFeed: Khung hiển thị danh sách tin nhắn cuộn với Scroll Anchoring, phân chia ngày, và Typing Bubble
 * - Avatar người gửi hiển thị ở đáy mỗi cụm tin nhắn đến (Telegram Grouping)
 * - Tự động tính toán trạng thái 1 tick (đã gửi) vs 2 ticks (đã đọc) qua lastReadMessageId
 * - Bong bóng gõ phím 3 chấm nhảy động khi đối phương đang soạn tin
 * - Nút tròn nổi cuộn nhanh về cuối khi người dùng cuộn lên trên
 */
export function MessageFeed({
  messages,
  currentUserId,
  isGroup = false,
  isLoadingOlder = false,
  hasMore = false,
  lastReadMessageId,
  typingUserNames = [],
  onLoadMore,
  onReact,
  onReply,
  onEdit,
  onRecall,
  onScrollToReply,
  onImageClick,
}: MessageFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const isAtBottomRef = useRef<boolean>(true)
  const prevMessagesCountRef = useRef<number>(messages.length)
  const [showScrollBottom, setShowScrollBottom] = useState(false)

  // Thời gian mốc của tin nhắn đã đọc gần nhất
  const lastReadTimestamp = useMemo(() => {
    if (!lastReadMessageId) return 0
    const targetMsg = messages.find((m) => m.id === lastReadMessageId)
    return targetMsg ? new Date(targetMsg.createdAt).getTime() : 0
  }, [messages, lastReadMessageId])

  // Kiểm tra xem người dùng có đang ở sát đáy khung chat không
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const threshold = 120
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    isAtBottomRef.current = isAtBottom
    setShowScrollBottom(!isAtBottom)

    // Kích hoạt load older messages khi cuộn lên gần đỉnh trần
    if (el.scrollTop < 60 && hasMore && !isLoadingOlder && onLoadMore) {
      prevScrollHeightRef.current = el.scrollHeight
      onLoadMore()
    }
  }, [hasMore, isLoadingOlder, onLoadMore])

  // Cuộn mượt mà về cuối trang
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [])

  // Scroll Anchoring: Giữ nguyên vị trí khi nối tin nhắn cũ vào đầu danh sách
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (prevScrollHeightRef.current > 0 && messages.length > prevMessagesCountRef.current) {
      const heightDiff = el.scrollHeight - prevScrollHeightRef.current
      el.scrollTop += heightDiff
      prevScrollHeightRef.current = 0
    } else if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }

    prevMessagesCountRef.current = messages.length
  }, [messages])

  // Tự động cuộn xuống đáy khi mới mở cuộc trò chuyện hoặc có tin nhắn mới
  useEffect(() => {
    const el = scrollRef.current
    if (el && isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none"
        data-testid="message-feed-empty"
      >
        <div className="max-w-sm px-6 py-5 rounded-3xl bg-surface-light/95 dark:bg-[#17212B]/95 backdrop-blur-md border border-border-light/60 dark:border-white/10 shadow-subtle flex flex-col items-center">
          <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand flex items-center justify-center mb-3">
            <MessageSquare className="w-6 h-6" />
          </div>
          <p className="text-[15px] font-semibold text-ink-primary dark:text-ink-primary-dark">
            Chưa có tin nhắn nào
          </p>
          <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark mt-1 leading-relaxed">
            Hãy gửi tin nhắn đầu tiên để bắt đầu trò chuyện!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 flex flex-col select-text"
        data-testid="message-feed"
      >
        {/* Vòng quay tải tin nhắn cũ */}
        {isLoadingOlder && (
          <div
            className="flex justify-center py-2 shrink-0"
            data-testid="feed-loading-older"
          >
            <Loader2 className="w-5 h-5 text-brand animate-spin" />
          </div>
        )}

        {/* Danh sách tin nhắn */}
        {messages.map((message, index) => {
          const prevMessage = index > 0 ? messages[index - 1] : undefined
          const nextMessage = index < messages.length - 1 ? messages[index + 1] : undefined

          const showDateDivider = isDifferentDay(
            message.createdAt,
            prevMessage?.createdAt
          )
          const isOutgoing = message.sender?.id === currentUserId

          // Tên người gửi ở đầu cụm tin nhắn nhóm
          const showSenderName =
            isGroup &&
            !isOutgoing &&
            (!prevMessage ||
              prevMessage.sender?.id !== message.sender?.id ||
              showDateDivider)

          // Avatar hiển thị ở cuối cụm tin nhắn từ cùng 1 người (Telegram Web Style)
          const showAvatar =
            !isOutgoing &&
            (!nextMessage ||
              nextMessage.sender?.id !== message.sender?.id ||
              isDifferentDay(nextMessage.createdAt, message.createdAt))

          // Xác định đã đọc: nếu có mốc lastReadMessageId và tin nhắn gửi trước hoặc bằng mốc đó
          const msgTime = new Date(message.createdAt).getTime()
          const isRead = Boolean(
            lastReadTimestamp > 0 && msgTime <= lastReadTimestamp
          )

          const isNewCluster =
            !prevMessage ||
            prevMessage.sender?.id !== message.sender?.id ||
            showDateDivider

          return (
            <div key={message.id} className={isNewCluster ? 'mt-2.5' : 'mt-0.5'}>
              {showDateDivider && <DateDivider date={message.createdAt} />}
              <MessageBubble
                message={message}
                isOutgoing={isOutgoing}
                isGroup={isGroup}
                showSenderName={showSenderName}
                showAvatar={showAvatar}
                isRead={isRead}
                onReact={onReact}
                onReply={onReply}
                onEdit={onEdit}
                onRecall={onRecall}
                onScrollToReply={onScrollToReply}
                onImageClick={onImageClick}
              />
            </div>
          )
        })}

        {/* Telegram Typing Bubble dưới đáy Feed */}
        {typingUserNames.length > 0 && (
          <div
            className="flex items-end gap-2 my-1 select-none animate-in fade-in slide-in-from-bottom-2 duration-200"
            data-testid="feed-typing-bubble"
          >
            <div className="w-8 h-8 rounded-full bg-brand-soft dark:bg-surface-dark-2 flex items-center justify-center text-brand dark:text-brand-accent text-xs font-semibold border border-border-light/40 dark:border-white/10 shrink-0 shadow-xs">
              {typingUserNames[0]?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-xs bg-bubble-in dark:bg-bubble-in-dark border border-black/5 dark:border-white/5 shadow-subtle flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand dark:bg-brand-accent animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand dark:bg-brand-accent animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-brand dark:bg-brand-accent animate-bounce" />
            </div>
          </div>
        )}
      </div>

      {/* Nút nổi cuộn xuống cuối khi cuộn ngược lên */}
      {showScrollBottom && (
        <button
          type="button"
          aria-label="Cuộn xuống tin nhắn mới nhất"
          title="Cuộn xuống tin nhắn mới nhất"
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 md:right-6 w-10 h-10 rounded-full bg-surface-light dark:bg-[#242F3D] text-ink-secondary dark:text-ink-secondary-dark shadow-md border border-border-light/60 dark:border-border-dark flex items-center justify-center hover:text-brand hover:bg-surface-hover dark:hover:bg-surface-dark-secondary transition-all hover:scale-105 active:scale-95 animate-in fade-in zoom-in-75 duration-150 z-20"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
