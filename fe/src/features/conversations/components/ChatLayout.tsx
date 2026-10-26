import { Outlet, useNavigate } from 'react-router-dom'
import { ConversationSidebar } from './ConversationSidebar'

/**
 * ChatLayout: Khung bố cục chính của phân hệ Trò chuyện (Chat Module)
 * - Cột bên trái (320px): Danh sách hộp thư ConversationSidebar
 * - Vùng bên phải: Canvas nội dung linh hoạt (WelcomeEmptyCanvas hoặc ChatRoom qua Outlet)
 */
export function ChatLayout() {
  const navigate = useNavigate()

  const handleSelectConversation = (conversationId: string) => {
    navigate(`/chat/${conversationId}`)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* 1. Sidebar danh sách đoạn chat (320px) */}
      <ConversationSidebar onSelectConversation={handleSelectConversation} />

      {/* 2. Vùng Canvas hiển thị nội dung chat */}
      <main
        role="region"
        aria-label="Khung trò chuyện chính"
        className="flex-1 min-w-0 h-full overflow-hidden bg-canvas-light dark:bg-canvas-dark"
      >
        <Outlet />
      </main>
    </div>
  )
}
