import { io, type Socket } from 'socket.io-client'

// URL kết nối WebSocket (ưu tiên env VITE_WS_URL, fallback về http://localhost:3000)
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000'

let socketInstance: Socket | null = null
let currentToken: string | null = null

/**
 * Singleton Socket Client Manager
 * Đảm bảo toàn bộ ứng dụng chỉ duy trì duy nhất 1 kết nối Socket.io,
 * triệt tiêu hoàn toàn lỗi Connection Leaks và Duplicate Event Handlers.
 */
export const socketClient = {
  /**
   * Lấy socket instance hiện tại
   */
  getSocket(): Socket | null {
    return socketInstance
  },

  /**
   * Cập nhật JWT token cho Socket hiện tại mà không làm rớt kết nối đang hoạt động
   */
  updateToken(token: string): void {
    currentToken = token
    if (socketInstance) {
      socketInstance.auth = {
        token: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      }
    }
  },

  /**
   * Khởi tạo hoặc tái sử dụng kết nối Socket với JWT token
   * Sử dụng Dynamic Token Handshake Callback để tự động cấp token mới nhất khi reconnect.
   */
  connect(token?: string): Socket {
    if (token) {
      currentToken = token
    }

    // Nếu socket đang kết nối hoặc đã kết nối, tái sử dụng instance hiện tại
    if (socketInstance && (socketInstance.connected || socketInstance.active)) {
      if (token) {
        this.updateToken(token)
      }
      return socketInstance
    }

    // Nếu socket cũ không còn hoạt động, dọn dẹp trước khi tạo mới
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
    }

    // Khởi tạo Socket.io client với dynamic auth callback (Task 7.2)
    socketInstance = io(WS_BASE_URL, {
      auth: (cb: (data: object) => void) => {
        const activeToken = currentToken || ''
        cb({
          token: activeToken.startsWith('Bearer ')
            ? activeToken
            : activeToken
              ? `Bearer ${activeToken}`
              : '',
        })
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
    })

    return socketInstance
  },

  /**
   * Ngắt kết nối một cách an toàn và giải phóng tài nguyên
   */
  disconnect(): void {
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
      currentToken = null
    }
  },
}
