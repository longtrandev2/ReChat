import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authApi } from '@/features/auth/services/auth.api'
import { postAuthBroadcast, type AuthBroadcastMessage } from '@/lib/auth-broadcast'
import type { UserProfile } from '@/types/auth.types'

const mocks = vi.hoisted(() => {
  let subscriber: ((msg: AuthBroadcastMessage) => void) | null = null
  return {
    getSubscriber: () => subscriber,
    setSubscriber: (listener: (msg: AuthBroadcastMessage) => void) => {
      subscriber = listener
    },
  }
})

// Mock auth-broadcast module before importing auth.store
vi.mock('@/lib/auth-broadcast', () => ({
  postAuthBroadcast: vi.fn(),
  subscribeToAuthBroadcast: vi.fn((listener) => {
    mocks.setSubscriber(listener)
    return () => {}
  }),
}))

// Mock authApi to isolate unit testing of store logic
vi.mock('@/features/auth/services/auth.api', () => ({
  authApi: {
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}))

import { useAuthStore } from './auth.store'

describe('useAuthStore (In-Memory Token & App Initialization Gate)', () => {
  const mockUser: UserProfile = {
    id: 'user-uuid-123',
    username: 'alex_tr',
    email: 'alex@rechat.app',
    displayName: 'Alex Tran',
    avatarUrl: undefined,
    isEmailVerified: true,
    twoFactorEnabled: false,
    createdAt: '2026-10-01T00:00:00.000Z',
  }

  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitializing: true,
      isLoading: false,
    })
    vi.clearAllMocks()
  })

  it('Z: initial state has null token and isInitializing true (RAM-only)', () => {
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isInitializing).toBe(true)
    expect(localStorage.getItem('rechat_access_token')).toBeNull()
  })

  it('O: setAuth stores token in RAM only and never writes to localStorage', () => {
    const token = 'jwt-token-in-memory-123'

    useAuthStore.getState().setAuth(token, mockUser)

    const state = useAuthStore.getState()
    expect(state.token).toBe(token)
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isInitializing).toBe(false)
    expect(state.isLoading).toBe(false)
    // CRITICAL: LocalStorage must remain clean to prevent XSS exfiltration
    expect(localStorage.getItem('rechat_access_token')).toBeNull()
  })

  it('M: setUser updates user profile in RAM without altering token', () => {
    const token = 'jwt-token-active'
    useAuthStore.getState().setAuth(token, mockUser)

    const updatedUser: UserProfile = {
      ...mockUser,
      displayName: 'Alex Updated',
      avatarUrl: 'https://example.com/avatar.jpg',
    }

    useAuthStore.getState().setUser(updatedUser)

    const state = useAuthStore.getState()
    expect(state.token).toBe(token)
    expect(state.user?.displayName).toBe('Alex Updated')
    expect(state.user?.avatarUrl).toBe('https://example.com/avatar.jpg')
    expect(state.isAuthenticated).toBe(true)
  })

  it('B: resetAuth clears all RAM states to null/false immediately', () => {
    useAuthStore.getState().setAuth('jwt-token-to-reset', mockUser)

    useAuthStore.getState().resetAuth()

    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isInitializing).toBe(false)
  })

  it('B: logout calls authApi.logout and resets RAM states', async () => {
    useAuthStore.getState().setAuth('jwt-token-to-logout', mockUser)
    vi.mocked(authApi.logout).mockResolvedValueOnce()

    await useAuthStore.getState().logout()

    expect(authApi.logout).toHaveBeenCalledTimes(1)
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isInitializing).toBe(false)
  })

  it('S: checkAuth successfully restores in-memory session when HttpOnly cookie is valid', async () => {
    const refreshResponse = {
      accessToken: 'new-restored-access-token',
      user: mockUser,
    }
    vi.mocked(authApi.refresh).mockResolvedValueOnce(refreshResponse)

    await useAuthStore.getState().checkAuth()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    const state = useAuthStore.getState()
    expect(state.token).toBe('new-restored-access-token')
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isInitializing).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('E: checkAuth sets unauthenticated state when HttpOnly cookie is missing or rejected (401)', async () => {
    vi.mocked(authApi.refresh).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Refresh token không tồn tại trong cookie' } },
    })

    await useAuthStore.getState().checkAuth()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isInitializing).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('E: checkAuth gracefully handles network failures without breaking the app', async () => {
    vi.mocked(authApi.refresh).mockRejectedValueOnce(new Error('Network Error'))

    await useAuthStore.getState().checkAuth()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isInitializing).toBe(false)
  })

  describe('Multi-Tab Synchronization via BroadcastChannel (Task 7.1)', () => {
    it('broadcasts AUTH_LOGIN when setAuth is called with default broadcast=true', () => {
      useAuthStore.getState().setAuth('tab-token-123', mockUser)

      expect(postAuthBroadcast).toHaveBeenCalledWith({
        type: 'AUTH_LOGIN',
        payload: { token: 'tab-token-123', user: mockUser },
      })
    })

    it('does not broadcast when setAuth is called with broadcast=false (prevent echo loop)', () => {
      useAuthStore.getState().setAuth('tab-token-123', mockUser, false)

      expect(postAuthBroadcast).not.toHaveBeenCalled()
    })

    it('broadcasts AUTH_LOGOUT when logout is called with default broadcast=true', async () => {
      useAuthStore.getState().setAuth('token-to-logout', mockUser, false)
      vi.mocked(authApi.logout).mockResolvedValueOnce()

      await useAuthStore.getState().logout()

      expect(postAuthBroadcast).toHaveBeenCalledWith({ type: 'AUTH_LOGOUT' })
    })

    it('broadcasts AUTH_TOKEN_REFRESHED when checkAuth succeeds', async () => {
      const refreshResponse = {
        accessToken: 'refreshed-multi-tab-token',
        user: mockUser,
      }
      vi.mocked(authApi.refresh).mockResolvedValueOnce(refreshResponse)

      await useAuthStore.getState().checkAuth()

      expect(postAuthBroadcast).toHaveBeenCalledWith({
        type: 'AUTH_TOKEN_REFRESHED',
        payload: { token: 'refreshed-multi-tab-token', user: mockUser },
      })
    })

    it('handles incoming AUTH_LOGOUT from another tab by resetting RAM auth state', () => {
      useAuthStore.getState().setAuth('active-tab-token', mockUser, false)
      expect(useAuthStore.getState().isAuthenticated).toBe(true)

      const subscriber = mocks.getSubscriber()
      expect(subscriber).toBeDefined()
      subscriber!({ type: 'AUTH_LOGOUT' })

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it('handles incoming AUTH_TOKEN_REFRESHED from another tab by updating RAM token without network call', () => {
      const subscriber = mocks.getSubscriber()
      expect(subscriber).toBeDefined()
      const newUser = { ...mockUser, username: 'synced_user' }

      subscriber!({
        type: 'AUTH_TOKEN_REFRESHED',
        payload: { token: 'peer-tab-token-777', user: newUser },
      })

      const state = useAuthStore.getState()
      expect(state.token).toBe('peer-tab-token-777')
      expect(state.user?.username).toBe('synced_user')
      expect(state.isAuthenticated).toBe(true)
      // Did NOT call authApi.refresh
      expect(authApi.refresh).not.toHaveBeenCalled()
    })

    it('handles incoming AUTH_LOGIN from another tab by syncing user into RAM', () => {
      const subscriber = mocks.getSubscriber()
      expect(subscriber).toBeDefined()

      subscriber!({
        type: 'AUTH_LOGIN',
        payload: { token: 'logged-in-token-888', user: mockUser },
      })

      const state = useAuthStore.getState()
      expect(state.token).toBe('logged-in-token-888')
      expect(state.user).toEqual(mockUser)
      expect(state.isAuthenticated).toBe(true)
    })
  })
})
