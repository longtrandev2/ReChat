import { useEffect, useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { ChatHeader } from './ChatHeader'
import { MessageFeed } from './MessageFeed'
import { MessageComposer } from './MessageComposer'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { useMessagesStore } from '../stores/messages.store'
import { useSocketStore } from '@/stores/socket.store'
import { useAuthStore } from '@/stores/auth.store'
import { socketClient } from '@/services/socket.client'

/**
 * ActiveChatCanvas: Vùng hiển thị cuộc hội thoại đang hoạt động (Active Chat Canvas)
 * - Tự động join/leave room WebSocket theo conversationId
 * - Đồng bộ tin nhắn ban đầu và phân trang cuộn lên (Load Older)
 * - Ráp nối ChatHeader, MessageFeed và MessageComposer
 */
export function ActiveChatCanvas() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { user } = useAuthStore()
  const { conversations, markConversationAsRead, setActiveConversation } =
    useConversationStore()
  const {
    messagesByConversation,
    hasMoreByConversation,
    typingUsers,
    isLoadingMessages,
    fetchMessages,
  } = useMessagesStore()
  const { userStatuses } = useSocketStore()

  // Tìm cuộc hội thoại hiện tại
  const conversation = useMemo(() => {
    return conversations.find((c) => c.id === conversationId)
  }, [conversations, conversationId])

  const messages = useMemo(() => {
    return conversationId ? messagesByConversation[conversationId] || [] : []
  }, [messagesByConversation, conversationId])

  const hasMore = useMemo(() => {
    return conversationId ? Boolean(hasMoreByConversation[conversationId]) : false
  }, [hasMoreByConversation, conversationId])

  const typingNames = useMemo(() => {
    if (!conversationId || !typingUsers[conversationId]) return []
    return Object.values(typingUsers[conversationId])
  }, [typingUsers, conversationId])

  // Trạng thái online của đối phương trong cuộc hội thoại trực tiếp
  const isOnline = useMemo(() => {
    if (!conversation || conversation.type === 'GROUP') return false
    // Kiểm tra qua lastMessage sender hoặc status store
    return Object.values(userStatuses || {}).some((s) => s?.status === 'ONLINE')
  }, [conversation, userStatuses])

  // Vòng đời Room WebSocket và tải tin nhắn ban đầu
  useEffect(() => {
    if (!conversationId) return

    setActiveConversation(conversationId)

    const socket = socketClient.getSocket()
    if (socket && socket.connected) {
      socket.emit('joinConversation', { conversationId })
    }

    // Tải 30 tin nhắn mới nhất
    fetchMessages(conversationId)
    markConversationAsRead(conversationId)

    return () => {
      if (socket && socket.connected) {
        socket.emit('leaveConversation', { conversationId })
      }
    }
  }, [conversationId, setActiveConversation, fetchMessages, markConversationAsRead])

  // Tải thêm tin nhắn cũ khi cuộn lên đỉnh
  const handleLoadMore = useCallback(() => {
    if (!conversationId || messages.length === 0 || isLoadingMessages) return
    const oldestMessage = messages[0]
    fetchMessages(conversationId, oldestMessage.id)
  }, [conversationId, messages, isLoadingMessages, fetchMessages])

  // Gửi tin nhắn qua WebSocket
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!conversationId) return
      const socket = socketClient.getSocket()
      if (socket && socket.connected) {
        socket.emit('sendMessage', {
          conversationId,
          content,
          type: 'TEXT',
        })
      }
    },
    [conversationId]
  )

  if (!conversation) {
    return (
      <div
        className="flex-1 flex items-center justify-center p-6 text-ink-secondary dark:text-ink-secondary-dark select-none"
        data-testid="chat-canvas-loading"
      >
        <p className="text-sm">Đang tải cuộc trò chuyện...</p>
      </div>
    )
  }

  return (
    <div
      className="flex-1 flex flex-col h-full bg-canvas-light dark:bg-canvas-dark overflow-hidden"
      data-testid="active-chat-canvas"
    >
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        isOnline={isOnline}
        typingUserNames={typingNames}
      />

      {/* Message Feed */}
      <MessageFeed
        messages={messages}
        currentUserId={user?.id || ''}
        isGroup={conversation.type === 'GROUP'}
        hasMore={hasMore}
        isLoadingOlder={isLoadingMessages}
        onLoadMore={handleLoadMore}
      />

      {/* Message Composer */}
      <MessageComposer
        conversationId={conversation.id}
        onSendMessage={handleSendMessage}
      />
    </div>
  )
}
