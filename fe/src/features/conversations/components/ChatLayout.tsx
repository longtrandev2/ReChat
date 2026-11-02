import { useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { ConversationSidebar } from './ConversationSidebar'
import { CreateGroupModal } from './CreateGroupModal'

/**
 * ChatLayout: Khung bố cục chính của phân hệ Trò chuyện (Chat Module)
 * - Cột bên trái (320px): Danh sách hộp thư ConversationSidebar
 * - Vùng bên phải: Canvas nội dung linh hoạt (WelcomeEmptyCanvas hoặc ChatRoom qua Outlet)
 */
export function ChatLayout() {
  const navigate = useNavigate()
  // Dưới md: chỉ hiện inbox (/chat) hoặc chat đang mở (/chat/:id), không hiện song song
  const hasActiveChat = Boolean(useMatch('/chat/:conversationId'))
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)

  const handleSelectConversation = (conversationId: string) => {
    navigate(`/chat/${conversationId}`)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 1. Sidebar danh sách đoạn chat (320px) */}
      <div
        className={cn(
          'h-full shrink-0 w-full md:w-auto',
          hasActiveChat ? 'hidden md:block' : 'block'
        )}
      >
        <ConversationSidebar
          onSelectConversation={handleSelectConversation}
          onOpenNewChatModal={() => setIsCreateGroupOpen(true)}
        />
      </div>

      {/* 2. Vùng Canvas hiển thị nội dung chat */}
      <main
        role="region"
        aria-label="Khung trò chuyện chính"
        className={cn(
          'flex-1 min-w-0 h-full overflow-hidden bg-canvas-light dark:bg-canvas-dark',
          !hasActiveChat && 'hidden md:block'
        )}
      >
        <Outlet />
      </main>

      {/* 3. Modal tạo nhóm chat mới */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
      />
    </div>
  )
}
