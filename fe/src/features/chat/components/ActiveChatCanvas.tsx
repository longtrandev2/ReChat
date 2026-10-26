import { useEffect, useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChatHeader } from './ChatHeader'
import { MessageFeed } from './MessageFeed'
import { MessageComposer } from './MessageComposer'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { useMessagesStore } from '../stores/messages.store'
import { useSocket } from '@/hooks/useSocket'
import { useAuthStore } from '@/stores/auth.store'
import { socketClient } from '@/services/socket.client'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import type { ConversationMemberUser } from '@/features/conversations/types/conversation.types'

/**
 * ActiveChatCanvas: Vùng hiển thị cuộc hội thoại đang hoạt động chuẩn Telegram Web
 * - Giao diện căn giữa cân đối (max-w-3xl mx-auto) với texture nền Telegram mờ nhẹ
 * - Bóc tách chính xác đối phương (partner) để hiển thị chấm xanh Online/Offline thời gian thực
 * - Tự động đồng bộ tin nhắn, gửi socket markAsRead và theo dõi trạng thái đã đọc
 */
export function ActiveChatCanvas() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { user } = useAuthStore()
  const { conversations, markConversationAsRead, setActiveConversation } =
    useConversationStore()
  const {
    messagesByConversation,
    hasMoreByConversation,
    lastReadMessageIdByConversation,
    typingUsers,
    isLoadingMessages,
    fetchMessages,
    handleMessageRecalled,
    handleMessageEdited,
    handleReactionUpdated,
  } = useMessagesStore()
  const { isUserOnline } = useSocket()

  // Thông tin đối phương trong cuộc trò chuyện trực tiếp (Direct)
  const [partner, setPartner] = useState<ConversationMemberUser | null>(null)

  // Tìm cuộc hội thoại trong Inbox store
  const conversation = useMemo(() => {
    return conversations.find((c) => c.id === conversationId)
  }, [conversations, conversationId])

  const messages = useMemo(() => {
    return conversationId ? messagesByConversation[conversationId] || [] : []
  }, [messagesByConversation, conversationId])

  const hasMore = useMemo(() => {
    return conversationId ? Boolean(hasMoreByConversation[conversationId]) : false
  }, [hasMoreByConversation, conversationId])

  const lastReadId = useMemo(() => {
    return conversationId ? lastReadMessageIdByConversation[conversationId] : undefined
  }, [lastReadMessageIdByConversation, conversationId])

  const typingNames = useMemo(() => {
    if (!conversationId || !typingUsers[conversationId]) return []
    return Object.values(typingUsers[conversationId])
  }, [typingUsers, conversationId])

  // Trạng thái online của đối phương qua socket presence hoặc initial detail
  const isPartnerOnline = useMemo(() => {
    if (!conversation || conversation.type === 'GROUP' || !partner?.id) return false
    try {
      if (typeof isUserOnline === 'function' && isUserOnline(partner.id)) {
        return true
      }
    } catch {
      // Fallback an toàn nếu socket store chưa sẵn sàng
    }
    return Boolean(partner.isOnline)
  }, [conversation, partner, isUserOnline])

  // Tải chi tiết cuộc hội thoại để bóc tách thông tin partner & initial online
  useEffect(() => {
    if (!conversationId) return

    let isMounted = true

    conversationApi
      .getConversationById(conversationId)
      .then((detail) => {
        if (!isMounted || !detail) return

        if (detail.type === 'DIRECT' && Array.isArray(detail.members)) {
          const otherMember = detail.members.find((m) => m?.user?.id !== user?.id)
          if (otherMember?.user) {
            setPartner(otherMember.user)
          }
        }
      })
      .catch(() => {
        // Fallback: nếu lỗi API detail thì vẫn giữ state bình thường
      })

    return () => {
      isMounted = false
    }
  }, [conversationId, user?.id])

  // Vòng đời Room WebSocket và lắng nghe tương tác tin nhắn
  useEffect(() => {
    if (!conversationId) return

    setActiveConversation(conversationId)

    const socket = socketClient.getSocket()
    if (socket && socket.connected) {
      socket.emit('joinConversation', { conversationId })
      socket.emit('markAsRead', { conversationId })
    }

    // Tải 30 tin nhắn mới nhất
    fetchMessages(conversationId)
    markConversationAsRead(conversationId)

    // Handlers lắng nghe sự kiện thu hồi, chỉnh sửa và thả cảm xúc
    const onRecalled = (payload: { conversationId: string; messageId: string }) => {
      if (payload.conversationId === conversationId) {
        handleMessageRecalled(payload.conversationId, payload.messageId)
      }
    }

    const onEdited = (payload: {
      conversationId: string
      messageId: string
      content: string
      editedAt?: string
    }) => {
      if (payload.conversationId === conversationId) {
        handleMessageEdited(
          payload.conversationId,
          payload.messageId,
          payload.content,
          payload.editedAt
        )
      }
    }

    const onReactionUpdated = (payload: {
      conversationId: string
      messageId: string
      emoji: string
      action: 'ADDED' | 'REMOVED' | 'CHANGED'
      user: { id: string; displayName?: string; username?: string }
    }) => {
      if (payload.conversationId === conversationId) {
        handleReactionUpdated(
          payload.conversationId,
          payload.messageId,
          payload.emoji,
          payload.action,
          payload.user,
          user?.id
        )
      }
    }

    if (socket && typeof socket.on === 'function') {
      socket.on('messageRecalled', onRecalled)
      socket.on('messageEdited', onEdited)
      socket.on('messageReactionUpdated', onReactionUpdated)
    }

    return () => {
      if (socket) {
        if (typeof socket.off === 'function') {
          socket.off('messageRecalled', onRecalled)
          socket.off('messageEdited', onEdited)
          socket.off('messageReactionUpdated', onReactionUpdated)
        }
        if (socket.connected && typeof socket.emit === 'function') {
          socket.emit('leaveConversation', { conversationId })
        }
      }
    }
  }, [
    conversationId,
    setActiveConversation,
    fetchMessages,
    markConversationAsRead,
    handleMessageRecalled,
    handleMessageEdited,
    handleReactionUpdated,
    user?.id,
  ])

  // Tải thêm tin nhắn cũ khi cuộn lên đỉnh
  const handleLoadMore = useCallback(() => {
    if (!conversationId || messages.length === 0 || isLoadingMessages) return
    const oldestMessage = messages[0]
    fetchMessages(conversationId, oldestMessage.id)
  }, [conversationId, messages, isLoadingMessages, fetchMessages])

  // Gửi tin nhắn qua WebSocket
  const handleSendMessage = useCallback(
    (content: string, replyToId?: string) => {
      if (!conversationId) return
      const socket = socketClient.getSocket()
      if (socket && socket.connected) {
        socket.emit('sendMessage', {
          conversationId,
          content,
          type: 'TEXT',
          ...(replyToId ? { replyToId } : {}),
        })
      }
    },
    [conversationId]
  )

  // Thả / gỡ reaction qua WebSocket
  const handleReact = useCallback(
    (message: { id: string }, emoji: string) => {
      if (!conversationId) return
      const socket = socketClient.getSocket()
      if (socket && socket.connected) {
        socket.emit('reactMessage', {
          conversationId,
          messageId: message.id,
          emoji,
        })
      }
    },
    [conversationId]
  )

  // Thu hồi tin nhắn qua WebSocket
  const handleRecall = useCallback(
    (message: { id: string }) => {
      if (!conversationId) return
      const socket = socketClient.getSocket()
      if (socket && socket.connected) {
        socket.emit('recallMessage', {
          conversationId,
          messageId: message.id,
        })
      }
    },
    [conversationId]
  )

  // Chỉnh sửa tin nhắn qua WebSocket
  const handleEditMessage = useCallback(
    (messageId: string, content: string) => {
      if (!conversationId) return
      const socket = socketClient.getSocket()
      if (socket && socket.connected) {
        socket.emit('editMessage', {
          conversationId,
          messageId,
          content,
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
      className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#E8EFF6] via-canvas-light to-[#E1EAF2] dark:from-[#111B27] dark:via-[#0E1621] dark:to-[#0A1017] relative overflow-hidden transition-colors"
      data-testid="active-chat-canvas"
    >
      {/* Texture họa tiết nền Telegram sang trọng */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.055] bg-[radial-gradient(#2481CC_1.2px,transparent_1.2px)] [background-size:20px_20px]"
        aria-hidden="true"
      />

      {/* Header cố định ở trên đỉnh */}
      <ChatHeader
        conversation={conversation}
        isOnline={isPartnerOnline}
        typingUserNames={typingNames}
      />

      {/* Cột luồng chat căn giữa (max-w-3xl) chuẩn Telegram Web */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 w-full max-w-3xl mx-auto">
        <MessageFeed
          messages={messages}
          currentUserId={user?.id || ''}
          isGroup={conversation.type === 'GROUP'}
          hasMore={hasMore}
          isLoadingOlder={isLoadingMessages}
          lastReadMessageId={lastReadId}
          typingUserNames={typingNames}
          onLoadMore={handleLoadMore}
          onReact={handleReact}
          onReply={(msg) => useMessagesStore.getState().setReplyingMessage(msg)}
          onRecall={handleRecall}
          onEdit={(msg) => useMessagesStore.getState().setEditingMessage({ id: msg.id, content: msg.content })}
        />

        <MessageComposer
          conversationId={conversation.id}
          onSendMessage={handleSendMessage}
          onEditMessage={handleEditMessage}
        />
      </div>
    </div>
  )
}
