import { useEffect } from 'react'
import { Search, X, MessageSquarePlus } from 'lucide-react'
import { useConversationStore, type FilterTab } from '../stores/conversation.store'
import { ConversationItem } from './ConversationItem'
import { useSocket } from '@/hooks/useSocket'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  onSelectConversation?: (conversationId: string) => void
  onOpenNewChatModal?: () => void
}

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'unread', label: 'Chưa đọc' },
  { id: 'group', label: 'Nhóm' },
]

/**
 * ConversationSidebar: Cột danh sách hộp thư 320px chuẩn phong cách Telegram Web
 * - Header kèm tiêu đề và nút tạo cuộc trò chuyện mới
 * - Thanh tìm kiếm tương tác với nút xóa nhanh
 * - Bộ 3 tab phân loại: Tất cả / Chưa đọc / Nhóm
 * - Danh sách cuộc trò chuyện tự cuộn mượt mà kèm Skeleton loading
 */
export function ConversationSidebar({
  onSelectConversation,
  onOpenNewChatModal,
}: ConversationSidebarProps) {
  const {
    conversations,
    activeConversationId,
    searchQuery,
    filterTab,
    isLoading,
    fetchInbox,
    setActiveConversation,
    setSearchQuery,
    setFilterTab,
    getFilteredConversations,
  } = useConversationStore()

  const { isUserOnline } = useSocket()

  // Nạp danh sách hộp thư lần đầu nếu chưa có dữ liệu
  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  const filteredList = getFilteredConversations()
  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadCount, 0)

  const handleSelect = (id: string) => {
    setActiveConversation(id)
    onSelectConversation?.(id)
  }

  return (
    <aside
      aria-label="Danh sách cuộc trò chuyện"
      className="w-80 h-full flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark shrink-0 select-none transition-colors duration-200"
    >
      {/* 1. Header: Tiêu đề & Nút Tạo mới */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-ink-primary dark:text-ink-primary-dark">
          Đoạn chat
        </h1>
        <button
          type="button"
          onClick={onOpenNewChatModal}
          title="Tạo cuộc trò chuyện mới"
          aria-label="Tạo cuộc trò chuyện mới"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand-accent hover:bg-surface-hover dark:hover:bg-surface-dark-secondary transition-all duration-150 active:scale-95"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Thanh tìm kiếm (Search Bar) */}
      <div className="px-3 py-2">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm đoạn chat..."
            aria-label="Tìm kiếm đoạn chat"
            className="w-full h-9 pl-9 pr-8 bg-canvas-light dark:bg-surface-dark-2 rounded-xl text-sm text-ink-primary dark:text-ink-primary-dark placeholder:text-ink-muted border border-transparent focus:border-brand/40 focus:bg-surface-light dark:focus:bg-surface-dark focus:outline-none transition-all duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              title="Xóa tìm kiếm"
              aria-label="Xóa tìm kiếm"
              className="absolute right-2.5 text-ink-muted hover:text-ink-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Filter Tabs (Tất cả / Chưa đọc / Nhóm) */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-light/60 dark:border-border-dark/60">
        {TABS.map((tab) => {
          const isActive = filterTab === tab.id
          const isUnreadTab = tab.id === 'unread'

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5',
                isActive
                  ? 'bg-brand text-white shadow-subtle'
                  : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-ink-primary-dark hover:bg-surface-hover dark:hover:bg-surface-dark-secondary'
              )}
            >
              <span>{tab.label}</span>
              {isUnreadTab && totalUnread > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-tight',
                    isActive ? 'bg-white text-brand' : 'bg-coral text-white'
                  )}
                >
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 4. Conversation List Area */}
      <div
        role="listbox"
        aria-label="Danh sách tin nhắn"
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1"
      >
        {isLoading && conversations.length === 0 ? (
          // Skeleton Loading
          <div className="space-y-3 p-2 animate-pulse" data-testid="sidebar-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-border-light dark:bg-border-dark shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-border-light dark:bg-border-dark rounded-md w-3/4" />
                  <div className="h-2.5 bg-border-light dark:bg-border-dark rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredList.length === 0 ? (
          // Empty State
          <div className="h-48 flex flex-col items-center justify-center text-center p-4">
            <p className="text-sm font-medium text-ink-secondary dark:text-ink-secondary-dark">
              {searchQuery
                ? `Không tìm thấy kết quả cho "${searchQuery}"`
                : filterTab === 'unread'
                ? 'Không có tin nhắn chưa đọc nào'
                : 'Chưa có cuộc trò chuyện nào'}
            </p>
            <p className="text-xs text-ink-muted mt-1">
              {searchQuery
                ? 'Hãy thử tìm kiếm với từ khóa khác'
                : 'Bắt đầu cuộc trò chuyện mới để kết nối bạn bè'}
            </p>
          </div>
        ) : (
          // Render Conversation Items
          filteredList.map((conv) => {
            const isOnline = Boolean(
              conv.type === 'DIRECT' &&
                conv.lastMessage?.sender &&
                isUserOnline(conv.lastMessage.sender.id)
            )

            return (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                isOnline={isOnline}
                onClick={() => handleSelect(conv.id)}
              />
            )
          })
        )}
      </div>
    </aside>
  )
}
