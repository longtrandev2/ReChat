import { Search, MoreVertical, Users, ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import type { Conversation } from '@/features/conversations/types/conversation.types'

interface ChatHeaderProps {
  conversation: Conversation
  isOnline?: boolean
  typingUserNames?: string[]
  onSearchClick?: () => void
  onInfoClick?: () => void
  onBackClick?: () => void
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
  onBackClick,
}: ChatHeaderProps) {
  const isGroup = conversation.type === 'GROUP'

  const handleBack = () => {
    if (onBackClick) {
      onBackClick()
    } else if (typeof window !== 'undefined') {
      window.history.back()
    }
  }

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
        <span className="text-xs text-brand dark:text-brand-accent font-medium flex items-center gap-1.5">
          <span className="flex items-center gap-0.5">
            <span className="w-1 h-1 rounded-full bg-brand dark:bg-brand-accent animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 rounded-full bg-brand dark:bg-brand-accent animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 rounded-full bg-brand dark:bg-brand-accent animate-bounce" />
          </span>
          <span>{names} đang soạn tin nhắn...</span>
        </span>
      )
    }

    if (isGroup) {
      return (
        <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark font-normal">
          {conversation.memberCount
            ? `${conversation.memberCount} thành viên`
            : 'Nhóm trò chuyện'}
        </span>
      )
    }

    return (
      <span className="text-xs text-ink-secondary dark:text-ink-secondary-dark font-normal flex items-center">
        {isOnline ? (
          <span className="text-presence-online font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-presence-online animate-pulse inline-block" />
            Đang trực tuyến
          </span>
        ) : (
          'Ngoại tuyến'
        )}
      </span>
    )
  }

  return (
    <header className="h-16 px-3 md:px-5 flex items-center justify-between border-b border-border-light/60 dark:border-border-dark bg-surface-light/85 dark:bg-[#17212B]/85 backdrop-blur-md select-none shrink-0 z-20 sticky top-0 transition-colors">
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        {/* Nút quay lại trên màn hình nhỏ */}
        <button
          type="button"
          aria-label="Quay lại danh sách chat"
          onClick={handleBack}
          className="md:hidden p-2 -ml-1 text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-ink-primary-dark rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 border border-border-light/60 dark:border-border-dark shadow-xs">
            <AvatarImage
              src={conversation.avatarUrl || undefined}
              alt={conversation.name}
            />
            <AvatarFallback className="bg-brand-soft text-brand font-semibold text-sm">
              {isGroup ? <Users className="w-5 h-5" /> : initials}
            </AvatarFallback>
          </Avatar>
          {!isGroup && <PresenceDot status={isOnline ? 'online' : 'offline'} />}
        </div>

        <div className="flex flex-col min-w-0 justify-center">
          <h2 className="text-[15px] font-semibold text-ink-primary dark:text-ink-primary-dark truncate leading-tight">
            {conversation.name}
          </h2>
          <div className="h-4 flex items-center mt-0.5">{renderSubtitle()}</div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 text-ink-secondary dark:text-ink-secondary-dark">
        <button
          type="button"
          aria-label="Tìm kiếm trong cuộc trò chuyện"
          title="Tìm kiếm tin nhắn"
          onClick={onSearchClick}
          className="p-2 rounded-xl hover:bg-surface-hover dark:hover:bg-surface-dark-secondary hover:text-ink-primary dark:hover:text-ink-primary-dark transition-all active:scale-95"
        >
          <Search className="w-5 h-5" />
        </button>
        <button
          type="button"
          aria-label="Thông tin hội thoại"
          title="Thông tin chi tiết"
          onClick={onInfoClick}
          className="p-2 rounded-xl hover:bg-surface-hover dark:hover:bg-surface-dark-secondary hover:text-ink-primary dark:hover:text-ink-primary-dark transition-all active:scale-95"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </header>
  )
}
