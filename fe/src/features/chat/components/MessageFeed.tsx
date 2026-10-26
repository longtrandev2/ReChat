import { useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
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
  onLoadMore?: () => void
}

/**
 * MessageFeed: Khung hiển thị danh sách tin nhắn cuộn với Scroll Anchoring và phân chia ngày
 * - Tự động cuộn xuống đáy khi có tin nhắn mới hoặc lần đầu load
 * - Neo vị trí cuộn (Scroll Anchoring) khi tải thêm tin nhắn cũ phía trên
 * - Chèn DateDivider tự động giữa các ngày khác nhau
 */
export function MessageFeed({
  messages,
  currentUserId,
  isGroup = false,
  isLoadingOlder = false,
  hasMore = false,
  onLoadMore,
}: MessageFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  const isAtBottomRef = useRef<boolean>(true)
  const prevMessagesCountRef = useRef<number>(messages.length)

  // Kiểm tra xem người dùng có đang ở sát đáy khung chat không
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const threshold = 100
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    isAtBottomRef.current = isAtBottom

    // Kích hoạt load older messages khi cuộn lên gần đỉnh trần
    if (el.scrollTop < 60 && hasMore && !isLoadingOlder && onLoadMore) {
      prevScrollHeightRef.current = el.scrollHeight
      onLoadMore()
    }
  }, [hasMore, isLoadingOlder, onLoadMore])

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

  // Tự động cuộn xuống đáy khi mới mở cuộc trò chuyện
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none"
        data-testid="message-feed-empty"
      >
        <div className="max-w-xs px-4 py-3 rounded-2xl bg-surface-light/90 dark:bg-surface-dark/90 backdrop-blur border border-border-light/60 dark:border-border-dark shadow-subtle">
          <p className="text-sm font-medium text-ink-primary dark:text-ink-primary-dark">
            Chưa có tin nhắn nào
          </p>
          <p className="text-xs text-ink-secondary dark:text-ink-secondary-dark mt-1">
            Hãy gửi tin nhắn đầu tiên để bắt đầu trò chuyện!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-3 flex flex-col select-text"
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
        const showDateDivider = isDifferentDay(
          message.createdAt,
          prevMessage?.createdAt
        )
        const isOutgoing = message.sender.id === currentUserId

        // Trong group chat, chỉ hiện tên nếu tin nhắn trước là của người khác hoặc có DateDivider
        const showSenderName =
          isGroup &&
          !isOutgoing &&
          (!prevMessage ||
            prevMessage.sender.id !== message.sender.id ||
            showDateDivider)

        return (
          <div key={message.id}>
            {showDateDivider && <DateDivider date={message.createdAt} />}
            <MessageBubble
              message={message}
              isOutgoing={isOutgoing}
              isGroup={isGroup}
              showSenderName={showSenderName}
            />
          </div>
        )
      })}
    </div>
  )
}
