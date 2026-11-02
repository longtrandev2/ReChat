import { useEffect } from 'react'
import { socketClient } from '@/services/socket.client'
import { useSocketStore } from '@/stores/socket.store'
import { useAuthStore } from '@/stores/auth.store'
import { postAuthBroadcast } from '@/lib/auth-broadcast'
import { playNotificationSound } from '@/lib/notification-sound'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { useMessagesStore } from '@/features/chat/stores/messages.store'
import { useFriendsStore } from '@/features/friends/stores/friends.store'
import type { FriendUser } from '@/features/friends/types/friends.types'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import type { BlockStatus, Conversation, LastMessage } from '@/features/conversations/types/conversation.types'
import type { Message } from '@/features/chat/types/message.types'

interface UserStatusEventPayload {
  userId: string
  status?: 'ONLINE' | 'OFFLINE'
  isOnline?: boolean
  lastSeen?: string
}

interface ConversationUpdatedPayload {
  conversation?: Conversation
  conversationId?: string
  lastMessage?: LastMessage
}

interface NewMessagePayload extends Message {
  conversationId: string
}

interface UserTypingPayload {
  conversationId: string
  userId: string
  username: string
  displayName: string
  avatarUrl?: string | null
  isTyping: boolean
}

interface UserBlockEventPayload {
  blockerId: string
  blockedId: string
  conversationId: string | null
}

interface MessageReadPayload {
  conversationId: string
  userId: string
  username?: string
  displayName?: string
  lastReadMessageId?: string
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

    let isRefreshingSocket = false

    const handleConnectError = async (error: Error) => {
      const isAuthError =
        error.message?.includes('Unauthorized') ||
        error.message?.includes('token') ||
        error.message?.includes('Token') ||
        error.message?.includes('jwt')

      if (isAuthError) {
        if (!isRefreshingSocket) {
          isRefreshingSocket = true
          try {
            // Thử refresh token trong nền bằng HttpOnly cookie
            await useAuthStore.getState().checkAuth()
            const freshToken = useAuthStore.getState().token
            if (freshToken) {
              socketClient.updateToken(freshToken)
              socket.connect()
              return
            }
          } catch {
            useAuthStore.getState().resetAuth()
          } finally {
            isRefreshingSocket = false
          }
        }
        return
      }

      setStatus('error', error.message || 'Lỗi kết nối máy chủ thời gian thực')
    }

    const handleForceLogout = (payload?: { reason?: string }) => {
      console.warn('Nhận lệnh cưỡng chế đăng xuất từ máy chủ:', payload?.reason)
      socketClient.disconnect()
      reset()
      useAuthStore.getState().resetAuth()
      postAuthBroadcast({ type: 'AUTH_LOGOUT' })
      if (typeof window !== 'undefined' && window.location && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }

    const handleUserStatus = (payload: UserStatusEventPayload) => {
      if (payload && payload.userId) {
        const status: 'ONLINE' | 'OFFLINE' =
          payload.status || (payload.isOnline ? 'ONLINE' : 'OFFLINE')
        updateUserStatus(payload.userId, status, payload.lastSeen)
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

    const handleNewMessage = (payload: NewMessagePayload) => {
      if (!payload || !payload.conversationId) return

      // 1. Nối tin nhắn mới vào kho tin nhắn của phòng
      useMessagesStore.getState().appendIncomingMessage(payload.conversationId, payload)

      // 2. Cập nhật dòng preview tin nhắn cuối trong danh sách Inbox
      const currentUserId = useAuthStore.getState().user?.id
      const isSelf = payload.sender?.id === currentUserId
      useConversationStore.getState().handleNewMessage(
        payload.conversationId,
        {
          id: payload.id,
          content: payload.content,
          type: payload.type,
          createdAt: payload.createdAt,
          sender: payload.sender,
        },
        isSelf
      )

      // 3. Phát âm thanh thông báo nếu hội thoại không bị tắt tiếng (FR-32, BR-31)
      if (!isSelf && typeof window !== 'undefined') {
        const conversation = useConversationStore
          .getState()
          .conversations.find((c) => c.id === payload.conversationId)

        let isMuted = conversation?.isMuted
        if (typeof isMuted !== 'boolean') {
          try {
            isMuted = localStorage.getItem(`rechat_muted_${payload.conversationId}`) === 'true'
          } catch {
            isMuted = false
          }
        }

        if (!isMuted) {
          playNotificationSound()
        }
      }
    }

    const handleUserTyping = (payload: UserTypingPayload) => {
      if (!payload || !payload.conversationId) return
      const currentUserId = useAuthStore.getState().user?.id
      // Không hiển thị trạng thái typing của chính mình
      if (payload.userId === currentUserId) return

      useMessagesStore.getState().setTypingStatus(
        payload.conversationId,
        payload.userId,
        payload.displayName || payload.username,
        payload.isTyping
      )
    }

    const handleMessageRead = (payload: MessageReadPayload) => {
      if (!payload || !payload.conversationId || !payload.lastReadMessageId) return
      useMessagesStore
        .getState()
        .setLastReadMessageId(payload.conversationId, payload.lastReadMessageId)
    }

    const handleGroupMembershipChanged = (payload: { conversationId: string; action: string }) => {
      if (!payload || !payload.conversationId) return
      if (payload.action === 'REMOVED' || payload.action === 'LEFT') {
        useConversationStore.getState().removeConversation(payload.conversationId)
      } else if (payload.action === 'ADDED') {
        conversationApi
          .getConversationById(payload.conversationId)
          .then((conv) => {
            if (conv) {
              useConversationStore.getState().addOrUpdateConversation(conv)
            }
          })
          .catch(() => {})
      }
    }

    const handleConversationCustomized = (payload: {
      conversationId: string
      changes?: { name?: string; avatarUrl?: string; quickEmoji?: string }
      name?: string
      avatarUrl?: string
      quickEmoji?: string
    }) => {
      if (!payload || !payload.conversationId) return
      const changes = payload.changes || {}
      const name = payload.name ?? changes.name
      const avatarUrl = payload.avatarUrl ?? changes.avatarUrl
      const quickEmoji = payload.quickEmoji ?? changes.quickEmoji
      useConversationStore.getState().updateConversation(payload.conversationId, {
        ...(name !== undefined ? { name } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(quickEmoji !== undefined ? { quickEmoji } : {}),
      })
    }

    const handleFriendAccepted = (payload: { friend?: FriendUser }) => {
      if (payload?.friend) {
        useFriendsStore.getState().handleFriendAdded(payload.friend)
      } else {
        useFriendsStore.getState().fetchFriends()
      }
      useFriendsStore.getState().fetchReceivedRequestsCount()
    }

    const handleFriendRemoved = (payload: { friendId: string }) => {
      if (payload?.friendId) {
        useFriendsStore.getState().handleFriendRemoved(payload.friendId)
      }
    }

    // Chặn / bỏ chặn realtime: cả hai phía cùng khóa/mở khóa composer (BR-38)
    const applyBlockEvent = (payload: UserBlockEventPayload, blocked: boolean) => {
      const myId = useAuthStore.getState().user?.id
      if (!payload || !myId) return
      const iAmBlocker = payload.blockerId === myId
      const otherId = iAmBlocker ? payload.blockedId : payload.blockerId
      const status: BlockStatus = !blocked ? 'NONE' : iAmBlocker ? 'BLOCKED_BY_ME' : 'BLOCKED_ME'

      const store = useConversationStore.getState()
      const target = payload.conversationId
        ? store.conversations.find((c) => c.id === payload.conversationId)
        : store.conversations.find(
            (c) =>
              c.type === 'DIRECT' &&
              (c.partnerId === otherId || c.members?.some((m) => m.user?.id === otherId))
          )
      if (!target) return
      store.updateConversation(target.id, {
        blockStatus: status,
        ...(blocked ? { isOnline: false } : {}),
      })
    }
    const handleUserBlocked = (payload: UserBlockEventPayload) => applyBlockEvent(payload, true)
    const handleUserUnblocked = (payload: UserBlockEventPayload) => applyBlockEvent(payload, false)

    const handleFriendRequestsChanged = () => {
      useFriendsStore.getState().fetchReceivedRequestsCount()
    }

    // Đăng ký listeners
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('FORCE_LOGOUT', handleForceLogout)
    socket.on('auth_error', handleForceLogout)
    socket.on('user_status', handleUserStatus)
    socket.on('userPresence', handleUserStatus)
    socket.on('conversationCreated', handleConversationCreated)
    socket.on('conversationUpdated', handleConversationUpdated)
    socket.on('newMessage', handleNewMessage)
    socket.on('userTyping', handleUserTyping)
    socket.on('messageRead', handleMessageRead)
    socket.on('groupMembershipChanged', handleGroupMembershipChanged)
    socket.on('conversationCustomized', handleConversationCustomized)
    socket.on('friendRequestAccepted', handleFriendAccepted)
    socket.on('friendRemoved', handleFriendRemoved)
    socket.on('userBlocked', handleUserBlocked)
    socket.on('userUnblocked', handleUserUnblocked)
    socket.on('friendRequestReceived', handleFriendRequestsChanged)
    socket.on('friendRequestCancelled', handleFriendRequestsChanged)
    socket.on('friendRequestRejected', handleFriendRequestsChanged)

    // Cập nhật trạng thái nếu socket đã kết nối trước đó
    if (socket.connected) {
      setStatus('connected')
    }

    // Cleanup khi layout unmount hoặc token thay đổi
    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('FORCE_LOGOUT', handleForceLogout)
      socket.off('auth_error', handleForceLogout)
      socket.off('user_status', handleUserStatus)
      socket.off('userPresence', handleUserStatus)
      socket.off('conversationCreated', handleConversationCreated)
      socket.off('conversationUpdated', handleConversationUpdated)
      socket.off('newMessage', handleNewMessage)
      socket.off('userTyping', handleUserTyping)
      socket.off('messageRead', handleMessageRead)
      socket.off('groupMembershipChanged', handleGroupMembershipChanged)
      socket.off('conversationCustomized', handleConversationCustomized)
      socket.off('friendRequestAccepted', handleFriendAccepted)
      socket.off('friendRemoved', handleFriendRemoved)
      socket.off('userBlocked', handleUserBlocked)
      socket.off('userUnblocked', handleUserUnblocked)
      socket.off('friendRequestReceived', handleFriendRequestsChanged)
      socket.off('friendRequestCancelled', handleFriendRequestsChanged)
      socket.off('friendRequestRejected', handleFriendRequestsChanged)
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
    status,
    isConnected,
    onlineUsers,
    isUserOnline,
    socket: socketClient.getSocket(),
  }
}
