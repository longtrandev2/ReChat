import { Search, MoreVertical, Users } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import type { Conversation } from '@/features/conversations/types/conversation.types'

interface ChatHeaderProps {
  conversation: Conversation
  isOnline?: boolean
  typingUserNames?: string[]
  onSearchClick?: () => void
  onInfoClick?: () => void
}

/**
 * ChatHeader: Thanh tiêu đề cuộc hội thoại theo chuẩn Telegram Web
 * - Avatar đối phương kèm PresenceDot (Direct) hoặc Icon nhóm (Group)
 * - Tên hội thoại & trạng thái thông minh (Đang trực tuyến / Số thành viên / Soạn tin nhắn)
 * - Nút tìm kiếm và tùy chọn thêm
 */
export function ChatHeader({
  conversation,
  isOnline = false,
  typingUserNames = [],
  onSearchClick,
  onInfoClick,
}: ChatHeaderProps) {
  const isGroup = conversation.type === 'GROUP'

  const initials =
    (conversation.name || 'U')
      .split(' ')
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U'

  const renderSubtitle = () => {
    if (typingUserNames.length > 0) {
      const names =
        typingUserNames.length === 1
          ? typingUserNames[0]
          : typingUserNames.join(', ')
      return (
        <span className="text-xs italic text-brand dark:text-brand-accent animate-pulse font-normal">
          {names} đang soạn tin nhắn...
        </span>
      )
    }

    if (isGroup) {
      return (
        <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
          {conversation.memberCount
            ? `${conversation.memberCount} thành viên`
            : 'Nhóm trò chuyện'}
        </span>
      )
    }

    return (
      <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark">
        {isOnline ? (
          <span className="text-presence-online font-medium">Đang trực tuyến</span>
        ) : (
          'Ngoại tuyến'
        )}
      </span>
    )
  }

  return (
    <header className="h-16 px-4 flex items-center justify-between border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark select-none shrink-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 border border-border-light/60 dark:border-border-dark">
            <AvatarImage
              src={conversation.avatarUrl || undefined}
              alt={conversation.name}
            />
            <AvatarFallback className="bg-brand-soft text-brand font-medium text-sm">
              {isGroup ? <Users className="w-5 h-5" /> : initials}
            </AvatarFallback>
          </Avatar>
          {!isGroup && <PresenceDot status={isOnline ? 'online' : 'offline'} />}
        </div>

        <div className="flex flex-col min-w-0 justify-center">
          <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark truncate leading-tight">
            {conversation.name}
          </h2>
          <div className="h-4 flex items-center">{renderSubtitle()}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 text-ink-secondary dark:text-ink-secondary-dark">
        <button
          type="button"
          aria-label="Tìm kiếm trong cuộc trò chuyện"
          onClick={onSearchClick}
          className="p-2 rounded-lg hover:bg-surface-hover dark:hover:bg-surface-dark-secondary transition-colors"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Thông tin hội thoại"
          onClick={onInfoClick}
          className="p-2 rounded-lg hover:bg-surface-hover dark:hover:bg-surface-dark-secondary transition-colors"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
