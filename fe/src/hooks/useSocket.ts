import { useEffect } from 'react'
import { socketClient } from '@/services/socket.client'
import { useSocketStore } from '@/stores/socket.store'
import { useAuthStore } from '@/stores/auth.store'

interface UserStatusEventPayload {
  userId: string
  status: 'ONLINE' | 'OFFLINE'
  lastSeen?: string
}

/**
 * Custom Hook: useSocket
 * Tự động gắn kết vòng đời kết nối WebSocket với trạng thái đăng nhập của người dùng.
 * - Khi có JWT Token: Tự động khởi tạo kết nối Handshake tới NestJS ChatGateway.
 * - Khi Đăng xuất: Ngắt kết nối và dọn sạch listeners.
 */
export function useSocket() {
  const { token, isAuthenticated } = useAuthStore()
  const { status, setStatus, updateUserStatus, reset } = useSocketStore()

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

    // Đăng ký listeners
    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('user_status', handleUserStatus)

    // Cập nhật trạng thái nếu socket đã kết nối trước đó
    if (socket.connected) {
      setStatus('connected')
    }

    // Cleanup khi component unmount hoặc token thay đổi
    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('user_status', handleUserStatus)
    }
  }, [token, isAuthenticated, setStatus, updateUserStatus, reset])

  return {
    socket: socketClient.getSocket(),
    status,
    isConnected: status === 'connected',
  }
}
