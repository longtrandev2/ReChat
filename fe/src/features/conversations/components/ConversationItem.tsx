import { Users, MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import { formatConversationTime } from '../utils/format-time'
import type { Conversation } from '../types/conversation.types'
import { cn } from '@/lib/utils'

interface ConversationItemProps {
  conversation: Conversation
  isActive?: boolean
  isOnline?: boolean
  onClick?: () => void
  onActionClick?: (e: React.MouseEvent) => void
}

/**
 * ConversationItem: Hiển thị một hàng hội thoại trong Inbox theo chuẩn Telegram Web
 * - Hỗ trợ Avatar cá nhân kèm PresenceDot (Direct) hoặc Icon nhóm (Group)
 * - Tên hội thoại & Timestamp (tabular-nums)
 * - Preview tin nhắn gần nhất & Badge số tin chưa đọc (Coral)
 * - Active pill indicator bar bên mép trái
 * - Hover state mượt mà với 3-dots action menu xuất hiện khi rê chuột
 */
export function ConversationItem({
  conversation,
  isActive = false,
  isOnline = false,
  onClick,
  onActionClick,
}: ConversationItemProps) {
  const isGroup = conversation.type === 'GROUP'
  const hasUnread = conversation.unreadCount > 0

  // Lấy initials fallback cho avatar
  const initials =
    (conversation.name || 'U')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  // Chuẩn hóa nội dung hiển thị của tin nhắn cuối
  const renderSnippet = () => {
    const lastMsg = conversation.lastMessage
    if (!lastMsg) {
      return (
        <span className="italic text-ink-muted">Chưa có tin nhắn</span>
      )
    }

    if (lastMsg.type === 'IMAGE') {
      return <span className="font-medium text-brand dark:text-brand-accent">[Hình ảnh]</span>
    }

    if (lastMsg.type === 'RAW') {
      return <span className="font-medium text-brand dark:text-brand-accent">[Tệp đính kèm]</span>
    }

    if (lastMsg.content.includes('[Tin nhắn đã bị thu hồi]')) {
      return <span className="italic text-ink-muted">[Tin nhắn đã thu hồi]</span>
    }

    return (
      <span className={cn('truncate', hasUnread && 'text-ink-primary dark:text-ink-primary-dark font-medium')}>
        {lastMsg.content}
      </span>
    )
  }

  const formattedTime = formatConversationTime(
    conversation.lastMessage?.createdAt || conversation.lastMessageAt || conversation.updatedAt
  )

  return (
    <button
      type="button"
      role="option"
      aria-selected={isActive}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 select-none text-left relative group',
        // Hover & Active States
        isActive
          ? 'bg-brand/10 dark:bg-brand-dark/25 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-brand before:rounded-r-full shadow-xs'
          : 'hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:translate-x-0.5 active:scale-[0.99]'
      )}
    >
      {/* 1. Avatar + Presence Dot */}
      <div className="relative shrink-0 transition-transform duration-150 group-hover:scale-[1.03]">
        <Avatar size="default" className="ring-1 ring-border-light dark:ring-border-dark">
          {conversation.avatarUrl && (
            <AvatarImage src={conversation.avatarUrl} alt={conversation.name} />
          )}
          <AvatarFallback className={isGroup ? 'bg-brand/10 text-brand' : undefined}>
            {isGroup ? <Users className="w-5 h-5" /> : initials}
          </AvatarFallback>
        </Avatar>
        {!isGroup && <PresenceDot isOnline={isOnline} />}
      </div>

      {/* 2. Content (Tên, Snippet & Badge / Action Menu) */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Row 1: Tên hội thoại & Thời gian */}
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <h3
            className={cn(
              'text-sm truncate leading-snug transition-colors',
              hasUnread
                ? 'font-bold text-ink-primary dark:text-ink-primary-dark'
                : 'font-medium text-ink-primary dark:text-ink-primary-dark group-hover:text-brand dark:group-hover:text-brand-accent'
            )}
          >
            {conversation.name}
          </h3>
          {formattedTime && (
            <span
              className={cn(
                'text-[11px] tabular-nums shrink-0 ml-2 transition-colors',
                hasUnread
                  ? 'text-brand font-semibold'
                  : 'text-ink-secondary dark:text-ink-secondary-dark'
              )}
            >
              {formattedTime}
            </span>
          )}
        </div>

        {/* Row 2: Snippet tin nhắn & Unread Counter / Quick Actions */}
        <div className="flex items-center justify-between gap-2 text-xs text-ink-secondary dark:text-ink-secondary-dark relative">
          <div className="truncate flex-1 pr-1">{renderSnippet()}</div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Quick Action Button - Appears on Hover */}
            <span
              role="button"
              tabIndex={0}
              aria-label="Tùy chọn hội thoại"
              onClick={(e) => {
                e.stopPropagation()
                onActionClick?.(e)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onActionClick?.(e as unknown as React.MouseEvent)
                }
              }}
              className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 hover:text-ink-primary dark:hover:text-white transition-all duration-150 cursor-pointer"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </span>

            {/* Unread Counter Badge */}
            {hasUnread && (
              <span
                data-testid="unread-badge"
                className="ml-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-coral text-white min-w-[18px] text-center leading-none shadow-subtle animate-in zoom-in-75 duration-150"
              >
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
