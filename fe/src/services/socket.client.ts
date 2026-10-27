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
   * Khởi tạo hoặc tái sử dụng kết nối Socket với JWT token
   */
  connect(token: string): Socket {
    // Nếu socket đang kết nối hoặc đã kết nối với cùng token, tái sử dụng instance hiện tại
    if (
      socketInstance &&
      currentToken === token &&
      (socketInstance.connected || socketInstance.active)
    ) {
      return socketInstance
    }

    // Nếu token thay đổi hoặc socket cũ không còn hoạt động, dọn dẹp trước khi tạo mới
    if (socketInstance) {
      socketInstance.removeAllListeners()
      socketInstance.disconnect()
      socketInstance = null
    }

    currentToken = token

    // Khởi tạo Socket.io client với handshake auth (BR-11)
    socketInstance = io(WS_BASE_URL, {
      auth: {
        token: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
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
