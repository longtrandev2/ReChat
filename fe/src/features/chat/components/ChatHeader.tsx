import {
  Search,
  MoreVertical,
  Users,
  ArrowLeft,
  Bell,
  BellOff,
  Info,
  Pin,
  PinOff,
  Trash2,
  Ban,
  ShieldCheck,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import type { BlockStatus, Conversation } from '@/features/conversations/types/conversation.types'

const ITEM_CLASS =
  'flex items-center gap-2 px-2.5 py-2 rounded-lg text-ink-primary dark:text-ink-primary-dark hover:bg-surface-hover dark:hover:bg-white/5 data-[highlighted]:bg-surface-hover dark:data-[highlighted]:bg-white/5 cursor-pointer focus:outline-hidden font-medium'
const DANGER_ITEM_CLASS =
  'flex items-center gap-2 px-2.5 py-2 rounded-lg text-coral dark:text-rose-400 hover:bg-coral-soft/50 dark:hover:bg-rose-950/30 data-[highlighted]:bg-coral-soft/50 cursor-pointer focus:outline-hidden font-medium'

interface ChatHeaderProps {
  conversation: Conversation
  isOnline?: boolean
  typingUserNames?: string[]
  isInfoOpen?: boolean
  isSearchOpen?: boolean
  isMuted?: boolean
  onSearchClick?: () => void
  onToggleMute?: () => void
  onInfoClick?: () => void
  onBackClick?: () => void
  isPinned?: boolean
  blockStatus?: BlockStatus
  onTogglePin?: () => void
  onClearHistory?: () => void
  onBlock?: () => void
  onUnblock?: () => void
}

/**
 * ChatHeader: Thanh tiêu đề cuộc hội thoại theo chuẩn Telegram Web
 * - Avatar đối phương kèm PresenceDot (Direct) hoặc Icon nhóm (Group)
 * - Tên hội thoại & trạng thái thông minh (Đang trực tuyến / Số thành viên / Soạn tin nhắn)
 * - Cho phép nhấp vào Avatar/Tiêu đề để mở bảng thông tin chi tiết (Telegram / Messenger style)
 * - Nút tìm kiếm và nút thông tin chi tiết (Info Drawer)
 */
export function ChatHeader({
  conversation,
  isOnline = false,
  typingUserNames = [],
  isInfoOpen = false,
  isSearchOpen = false,
  isMuted = false,
  onSearchClick,
  onToggleMute,
  onInfoClick,
  onBackClick,
  isPinned = false,
  blockStatus = 'NONE',
  onTogglePin,
  onClearHistory,
  onBlock,
  onUnblock,
}: ChatHeaderProps) {
  const isGroup = conversation.type === 'GROUP'
  // Khi bị chặn (hai chiều) không hiển thị trạng thái hoạt động của đối phương (BR-38)
  const isBlocked = !isGroup && blockStatus !== 'NONE'
  const showOnline = isOnline && !isBlocked

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
        {showOnline ? (
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

        {/* Nhấp vào Avatar hoặc Tiêu đề để mở bảng thông tin chi tiết */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Xem thông tin cuộc trò chuyện"
          onClick={onInfoClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onInfoClick?.()
            }
          }}
          className="flex items-center gap-2 md:gap-3 min-w-0 cursor-pointer group/title select-none rounded-xl p-1 -m-1 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <div className="relative shrink-0">
            <Avatar className="w-10 h-10 border border-border-light/60 dark:border-border-dark shadow-xs group-hover/title:scale-102 transition-transform">
              <AvatarImage
                src={conversation.avatarUrl || undefined}
                alt={conversation.name}
              />
              <AvatarFallback className="bg-brand-soft text-brand font-semibold text-sm">
                {isGroup ? <Users className="w-5 h-5" /> : initials}
              </AvatarFallback>
            </Avatar>
            {!isGroup && <PresenceDot isOnline={showOnline} />}
          </div>

          <div className="flex flex-col min-w-0 justify-center text-left">
            <h2 className="text-[15px] font-semibold text-ink-primary dark:text-ink-primary-dark truncate leading-tight group-hover/title:text-brand dark:group-hover/title:text-brand-accent transition-colors">
              {conversation.name}
            </h2>
            <div className="h-4 flex items-center mt-0.5">{renderSubtitle()}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 text-ink-secondary dark:text-ink-secondary-dark">
        <button
          type="button"
          aria-label="Tìm kiếm trong cuộc trò chuyện"
          title="Tìm kiếm tin nhắn"
          onClick={onSearchClick}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            isSearchOpen
              ? 'bg-brand/10 text-brand dark:bg-white/10 dark:text-brand-accent'
              : 'hover:bg-surface-hover dark:hover:bg-surface-dark-secondary hover:text-ink-primary dark:hover:text-ink-primary-dark'
          }`}
          data-testid="chat-header-search-btn"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          type="button"
          aria-label={isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
          title={isMuted ? 'Bật thông báo' : 'Tắt thông báo'}
          onClick={onToggleMute}
          className={`p-2 rounded-xl transition-all active:scale-95 ${
            isMuted
              ? 'text-coral hover:bg-coral/10'
              : 'hover:bg-surface-hover dark:hover:bg-surface-dark-secondary hover:text-ink-primary dark:hover:text-ink-primary-dark'
          }`}
          data-testid="chat-header-mute-btn"
        >
          {isMuted ? <BellOff className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Tùy chọn hội thoại"
              title="Tùy chọn"
              className={`p-2 rounded-xl transition-all active:scale-95 ${
                isInfoOpen
                  ? 'bg-brand/10 text-brand dark:bg-white/10 dark:text-brand-accent'
                  : 'hover:bg-surface-hover dark:hover:bg-surface-dark-secondary hover:text-ink-primary dark:hover:text-ink-primary-dark'
              }`}
              data-testid="chat-header-menu-btn"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="min-w-[200px] bg-white dark:bg-[#1C2733] rounded-xl p-1.5 shadow-xl border border-border/80 dark:border-border-dark text-xs z-50 animate-in fade-in-50 zoom-in-95 duration-150"
            >
              <DropdownMenu.Item
                onSelect={() => onInfoClick?.()}
                className={ITEM_CLASS}
                data-testid="chat-menu-info"
              >
                <Info className="w-4 h-4 shrink-0" />
                <span>Xem thông tin</span>
              </DropdownMenu.Item>

              {onTogglePin && (
                <DropdownMenu.Item
                  onSelect={() => onTogglePin()}
                  className={ITEM_CLASS}
                  data-testid="chat-menu-pin"
                >
                  {isPinned ? <PinOff className="w-4 h-4 shrink-0" /> : <Pin className="w-4 h-4 shrink-0" />}
                  <span>{isPinned ? 'Bỏ ghim' : 'Ghim cuộc trò chuyện'}</span>
                </DropdownMenu.Item>
              )}

              {onClearHistory && (
                <DropdownMenu.Item
                  onSelect={() => onClearHistory()}
                  className={DANGER_ITEM_CLASS}
                  data-testid="chat-menu-clear"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Xóa đoạn chat</span>
                </DropdownMenu.Item>
              )}

              {!isGroup && blockStatus === 'BLOCKED_BY_ME' && onUnblock && (
                <DropdownMenu.Item
                  onSelect={() => onUnblock()}
                  className={ITEM_CLASS}
                  data-testid="chat-menu-unblock"
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Bỏ chặn</span>
                </DropdownMenu.Item>
              )}

              {!isGroup && blockStatus === 'NONE' && onBlock && (
                <DropdownMenu.Item
                  onSelect={() => onBlock()}
                  className={DANGER_ITEM_CLASS}
                  data-testid="chat-menu-block"
                >
                  <Ban className="w-4 h-4 shrink-0" />
                  <span>Chặn người dùng</span>
                </DropdownMenu.Item>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
