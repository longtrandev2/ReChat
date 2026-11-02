import { create } from 'zustand'
import { authApi } from '@/features/auth/services/auth.api'
import {
  registerTokenGetter,
  registerAuthRefreshHandler,
  registerAuthResetHandler,
} from '@/services/api.client'
import { socketClient } from '@/services/socket.client'
import {
  postAuthBroadcast,
  subscribeToAuthBroadcast,
} from '@/lib/auth-broadcast'
import type { UserProfile } from '@/types/auth.types'

interface AuthState {
  token: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  isInitializing: boolean
  isLoading: boolean

  // Actions
  setAuth: (token: string, user: UserProfile, broadcast?: boolean) => void
  setUser: (user: UserProfile) => void
  resetAuth: () => void
  logout: (broadcast?: boolean) => Promise<void>
  checkAuth: () => Promise<void>
  initializeAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // In-Memory State: Tuyệt đối không đọc/ghi localStorage, ngăn chặn mã độc XSS
  token: null,
  user: null,
  isAuthenticated: false,
  isInitializing: true, // App Initialization Gate: Mặc định true để chặn redirect khi F5
  isLoading: false,

  setAuth: (token: string, user: UserProfile, broadcast = true) => {
    set({
      token,
      user,
      isAuthenticated: true,
      isInitializing: false,
      isLoading: false,
    })
    if (broadcast) {
      postAuthBroadcast({
        type: 'AUTH_LOGIN',
        payload: { token, user },
      })
    }
  },

  setUser: (user: UserProfile) => {
    set({ user })
  },

  resetAuth: () => {
    socketClient.disconnect()
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitializing: false,
      isLoading: false,
    })
  },

  logout: async (broadcast = true) => {
    try {
      set({ isLoading: true })
      await authApi.logout()
    } catch (error) {
      console.warn('Lỗi khi gọi API đăng xuất:', error)
    } finally {
      get().resetAuth()
      if (broadcast) {
        postAuthBroadcast({ type: 'AUTH_LOGOUT' })
      }
    }
  },

  /**
   * Khởi tạo và khôi phục phiên khi người dùng F5 hoặc mở ứng dụng:
   * Gọi POST /api/v1/auth/refresh (trình duyệt tự đính kèm HttpOnly cookie và X-Device-Id).
   * - Nếu hợp lệ: Cấp Access Token mới vào RAM + nạp UserProfile mà không bị nháy màn hình login.
   * - Nếu hết hạn / không có cookie: Chuyển về unauthenticated và cho phép điều hướng.
   */
  checkAuth: async () => {
    try {
      set({ isInitializing: true, isLoading: true })
      const res = await authApi.refresh()
      if (res && res.accessToken && res.user) {
        set({
          token: res.accessToken,
          user: res.user,
          isAuthenticated: true,
          isInitializing: false,
          isLoading: false,
        })
        postAuthBroadcast({
          type: 'AUTH_TOKEN_REFRESHED',
          payload: { token: res.accessToken, user: res.user },
        })
        return
      }
      get().resetAuth()
    } catch {
      // Cookie không tồn tại hoặc phiên hết hạn (401/403)
      get().resetAuth()
    }
  },

  // Giữ alias tương thích ngược cho các component/tests cũ
  initializeAuth: async () => {
    return get().checkAuth()
  },
}))

// Đăng ký token getter để apiClient tự động đọc Access Token từ RAM store
registerTokenGetter(() => useAuthStore.getState().token)

// Đăng ký handler tự động làm mới token cho Axios Silent Refresh Interceptor (Task 6)
registerAuthRefreshHandler(async () => {
  try {
    const res = await authApi.refresh()
    if (res && res.accessToken && res.user) {
      useAuthStore.getState().setAuth(res.accessToken, res.user, false)
      postAuthBroadcast({
        type: 'AUTH_TOKEN_REFRESHED',
        payload: { token: res.accessToken, user: res.user },
      })
      return res.accessToken
    }
    return null
  } catch {
    return null
  }
})

// Đăng ký handler dọn dẹp state khi phiên xác thực thất bại
registerAuthResetHandler(() => {
  useAuthStore.getState().resetAuth()
})

// Đăng ký đồng bộ hóa đa tab qua BroadcastChannel (Task 7.1 & Task 7.2)
subscribeToAuthBroadcast((message) => {
  if (message.type === 'AUTH_LOGOUT') {
    socketClient.disconnect()
    useAuthStore.getState().resetAuth()
    if (typeof window !== 'undefined' && window.location) {
      const currentPath = window.location.pathname || ''
      const isPublicPage =
        currentPath.includes('/login') ||
        currentPath.includes('/register') ||
        currentPath.includes('/verify-otp') ||
        currentPath.includes('/verify-2fa') ||
        currentPath.includes('/forgot-password') ||
        currentPath.includes('/reset-password')

      if (!isPublicPage && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
  } else if (message.type === 'AUTH_TOKEN_REFRESHED') {
    useAuthStore.getState().setAuth(message.payload.token, message.payload.user, false)
    socketClient.updateToken(message.payload.token)
  } else if (message.type === 'AUTH_USER_UPDATED') {
    // Chỉ cập nhật hồ sơ trong RAM, không gọi network; bỏ qua nếu tab này chưa đăng nhập
    if (useAuthStore.getState().isAuthenticated) {
      useAuthStore.getState().setUser(message.payload.user)
    }
  } else if (message.type === 'AUTH_LOGIN') {
    useAuthStore.getState().setAuth(message.payload.token, message.payload.user, false)
    socketClient.updateToken(message.payload.token)
    if (typeof window !== 'undefined' && window.location) {
      const currentPath = window.location.pathname || ''
      if (currentPath === '/login' || currentPath === '/register') {
        window.location.href = '/chat'
      }
    }
  }
})

