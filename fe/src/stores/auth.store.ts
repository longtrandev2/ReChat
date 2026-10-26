import { create } from 'zustand'
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
    } catch {
      // 401 or network error
      get().logout()
    }
  },
}))
