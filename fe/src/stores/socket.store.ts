import { create } from 'zustand'

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface UserPresence {
  status: 'ONLINE' | 'OFFLINE'
  lastSeen?: string
}

interface SocketState {
  status: SocketStatus
  error: string | null
  // Bản đồ theo dõi trạng thái trực tuyến của bạn bè và người dùng (key: userId)
  onlineUsers: Record<string, UserPresence>

  // Actions
  setStatus: (status: SocketStatus, error?: string | null) => void
  updateUserStatus: (userId: string, status: 'ONLINE' | 'OFFLINE', lastSeen?: string) => void
  isUserOnline: (userId: string) => boolean
  reset: () => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  status: 'disconnected',
  error: null,
  onlineUsers: {},

  setStatus: (status, error = null) => {
    set({ status, error })
  },

  updateUserStatus: (userId, status, lastSeen) => {
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        [userId]: { status, lastSeen },
      },
    }))
  },

  isUserOnline: (userId) => {
    return get().onlineUsers[userId]?.status === 'ONLINE'
  },

  reset: () => {
    set({
      status: 'disconnected',
      error: null,
      onlineUsers: {},
    })
  },
}))
