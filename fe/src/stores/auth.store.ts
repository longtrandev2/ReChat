import { create } from 'zustand'
import axios from 'axios'
import { apiClient } from '@/services/api.client'
import type { UserProfile } from '@/types/auth.types'

interface AuthState {
  token: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setAuth: (token: string, user: UserProfile) => void
  setUser: (user: UserProfile) => void
  logout: () => void
  initializeAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('rechat_access_token'),
  user: null,
  isAuthenticated: Boolean(localStorage.getItem('rechat_access_token')),
  isLoading: Boolean(localStorage.getItem('rechat_access_token')),

  setAuth: (token: string, user: UserProfile) => {
    localStorage.setItem('rechat_access_token', token)
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    })
  },

  setUser: (user: UserProfile) => {
    set({ user })
  },

  logout: () => {
    localStorage.removeItem('rechat_access_token')
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    })
  },

  /**
   * Initializes session on app load by fetching GET /api/v1/auth/me
   * If token is invalid or blacklisted, logout is triggered.
   */
  initializeAuth: async () => {
    const token = get().token
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    try {
      set({ isLoading: true })
      const response = await apiClient.get<UserProfile>('/auth/me')
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error: unknown) {
      const is401 =
        axios.isAxiosError(error)
          ? error.response?.status === 401
          : typeof error === 'object' &&
            error !== null &&
            'response' in error &&
            (error as { response?: { status?: number } }).response?.status === 401

      if (is401) {
        // Chỉ đăng xuất khi token thực sự hết hạn hoặc bị thu hồi (401)
        get().logout()
      } else {
        // Lỗi 429 Too Many Requests hoặc sự cố mạng/server tạm thời:
        // Bảo lưu token và session hợp lệ, không đá văng người dùng ra trang login
        set({ isLoading: false })
      }
    }
  },
}))
