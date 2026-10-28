import { create } from 'zustand'
import { authApi } from '@/features/auth/services/auth.api'
import { registerTokenGetter } from '@/services/api.client'
import type { UserProfile } from '@/types/auth.types'

interface AuthState {
  token: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  isInitializing: boolean
  isLoading: boolean

  // Actions
  setAuth: (token: string, user: UserProfile) => void
  setUser: (user: UserProfile) => void
  resetAuth: () => void
  logout: () => Promise<void>
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

  setAuth: (token: string, user: UserProfile) => {
    set({
      token,
      user,
      isAuthenticated: true,
      isInitializing: false,
      isLoading: false,
    })
  },

  setUser: (user: UserProfile) => {
    set({ user })
  },

  resetAuth: () => {
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitializing: false,
      isLoading: false,
    })
  },

  logout: async () => {
    try {
      set({ isLoading: true })
      await authApi.logout()
    } catch (error) {
      console.warn('Lỗi khi gọi API đăng xuất:', error)
    } finally {
      get().resetAuth()
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

