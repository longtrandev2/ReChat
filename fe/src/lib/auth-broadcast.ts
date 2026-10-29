import type { UserProfile } from '@/types/auth.types'

export const AUTH_BROADCAST_CHANNEL_NAME = 'rechat_auth_bus'

export type AuthBroadcastMessage =
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_LOGIN'; payload: { token: string; user: UserProfile } }
  | { type: 'AUTH_TOKEN_REFRESHED'; payload: { token: string; user: UserProfile } }

let broadcastChannelInstance: BroadcastChannel | null = null

/**
 * Trả về instance BroadcastChannel singleton an toàn
 */
export const getBroadcastChannel = (): BroadcastChannel | null => {
  if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') {
    return null
  }
  if (!broadcastChannelInstance) {
    try {
      broadcastChannelInstance = new window.BroadcastChannel(AUTH_BROADCAST_CHANNEL_NAME)
    } catch {
      broadcastChannelInstance = null
    }
  }
  return broadcastChannelInstance
}

/**
 * Phát sự kiện xác thực sang tất cả các tab khác đang mở
 */
export const postAuthBroadcast = (message: AuthBroadcastMessage): void => {
  try {
    const channel = getBroadcastChannel()
    if (channel) {
      channel.postMessage(message)
    }
  } catch (error) {
    console.warn('Lỗi khi phát sự kiện BroadcastChannel:', error)
  }
}

/**
 * Đăng ký lắng nghe các sự kiện xác thực từ các tab khác
 * @returns Hàm dọn dẹp listener (cleanup)
 */
export const subscribeToAuthBroadcast = (
  listener: (message: AuthBroadcastMessage) => void
): (() => void) => {
  const channel = getBroadcastChannel()
  if (!channel) {
    return () => {}
  }

  const handleMessage = (event: MessageEvent<AuthBroadcastMessage>) => {
    if (event.data && typeof event.data === 'object' && 'type' in event.data) {
      listener(event.data)
    }
  }

  channel.addEventListener('message', handleMessage)

  return () => {
    channel.removeEventListener('message', handleMessage)
  }
}

/**
 * Đóng instance BroadcastChannel (dùng trong dọn dẹp hoặc unit test)
 */
export const closeAuthBroadcast = (): void => {
  if (broadcastChannelInstance) {
    try {
      broadcastChannelInstance.close()
    } catch {
      // Bỏ qua lỗi khi đóng kênh
    }
    broadcastChannelInstance = null
  }
}
