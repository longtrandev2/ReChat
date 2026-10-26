import { useEffect } from 'react'
import { socketClient } from '@/services/socket.client'
import { useSocketStore } from '@/stores/socket.store'
import { useAuthStore } from '@/stores/auth.store'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import type { Conversation, LastMessage } from '@/features/conversations/types/conversation.types'

interface UserStatusEventPayload {
  userId: string
  status: 'ONLINE' | 'OFFLINE'
  lastSeen?: string
}

interface ConversationUpdatedPayload {
  conversation?: Conversation
  conversationId?: string
  lastMessage?: LastMessage
}

/**
 * useSocketInit: Quản lý vòng đời kết nối WebSocket gắn với phiên đăng nhập.
 * Được mount 1 lần duy nhất tại AppLayout để ngăn chặn duplicate event listeners.
 */
export function useSocketInit() {
  const { token, isAuthenticated } = useAuthStore()
  const { setStatus, updateUserStatus, reset } = useSocketStore()

  useEffect(() => {
    // Nếu chưa đăng nhập hoặc không có token, đảm bảo ngắt kết nối
    if (!isAuthenticated || !token) {
      socketClient.disconnect()
      reset()
      return
    }

    setStatus('connecting')
    const socket = socketClient.connect(token)

    // Handlers
    const handleConnect = () => {
      setStatus('connected')
    }

    const handleDisconnect = () => {
      setStatus('disconnected')
    }

    const handleConnectError = (error: Error) => {
      setStatus('error', error.message || 'Lỗi kết nối máy chủ thời gian thực')
    }

    const handleUserStatus = (payload: UserStatusEventPayload) => {
      if (payload && payload.userId && payload.status) {
        updateUserStatus(payload.userId, payload.status, payload.lastSeen)
      }
    }

    const handleConversationCreated = (conversation: Conversation) => {
      if (conversation) {
        useConversationStore.getState().addOrUpdateConversation(conversation)
      }
    }

    const handleConversationUpdated = (payload: ConversationUpdatedPayload) => {
      if (!payload) return
      if (payload.conversation) {
        useConversationStore.getState().addOrUpdateConversation(payload.conversation)
      } else if (payload.conversationId && payload.lastMessage) {
        useConversationStore.getState().handleNewMessage(payload.conversationId, payload.lastMessage)
      }
    }

    // Đăng ký listeners
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('user_status', handleUserStatus)
    socket.on('userPresence', handleUserStatus)
    socket.on('conversationCreated', handleConversationCreated)
    socket.on('conversationUpdated', handleConversationUpdated)

    // Cập nhật trạng thái nếu socket đã kết nối trước đó
    if (socket.connected) {
      setStatus('connected')
    }

    // Cleanup khi layout unmount hoặc token thay đổi
    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('user_status', handleUserStatus)
      socket.off('userPresence', handleUserStatus)
      socket.off('conversationCreated', handleConversationCreated)
      socket.off('conversationUpdated', handleConversationUpdated)
    }
  }, [token, isAuthenticated, setStatus, updateUserStatus, reset])
}

/**
 * useSocket: Hook tiêu dùng trạng thái Socket từ Store cho UI components.
 * An toàn khi gọi ở nhiều nơi mà không tạo thêm socket connection hay duplicate listeners.
 */
export function useSocket() {
  const status = useSocketStore((state) => state.status)
  const isConnected = status === 'connected'
  const onlineUsers = useSocketStore((state) => state.onlineUsers)
  const isUserOnline = useSocketStore((state) => state.isUserOnline)

  return {
    socket: socketClient.getSocket(),
    status,
    isConnected,
    onlineUsers,
    isUserOnline,
  }
}
