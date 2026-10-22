import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from './auth.store'
import { apiClient } from '@/services/api.client'
import type { UserProfile } from '@/types/auth.types'

// Mock apiClient to isolate unit testing of store logic
vi.mock('@/services/api.client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('useAuthStore (ZOMBIES & AAA Methodology)', () => {
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
      isLoading: false,
    })
    vi.clearAllMocks()
  })

  // Z - Zero: Initial/Empty session
  it('Z: initializeAuth completes with unauthenticated state when no token exists in localStorage', async () => {
    // Arrange: Ensure clean storage
    expect(localStorage.getItem('rechat_access_token')).toBeNull()

    // Act
    await useAuthStore.getState().initializeAuth()

    // Assert
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  // O - One: Set authenticated session
  it('O: setAuth stores token in localStorage and updates in-memory state', () => {
    // Arrange
    const token = 'jwt-token-sample-123'

    // Act
    useAuthStore.getState().setAuth(token, mockUser)

    // Assert
    const state = useAuthStore.getState()
    expect(state.token).toBe(token)
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
    expect(localStorage.getItem('rechat_access_token')).toBe(token)
  })

  // M - Many: Updates user profile without touching token
  it('M: setUser updates the user object while preserving authentication token', () => {
    // Arrange
    const token = 'jwt-token-active'
    useAuthStore.getState().setAuth(token, mockUser)

    const updatedUser: UserProfile = {
      ...mockUser,
      displayName: 'Alex Updated',
      avatarUrl: 'https://example.com/avatar.jpg',
    }

    // Act
    useAuthStore.getState().setUser(updatedUser)

    // Assert
    const state = useAuthStore.getState()
    expect(state.token).toBe(token)
    expect(state.user?.displayName).toBe('Alex Updated')
    expect(state.user?.avatarUrl).toBe('https://example.com/avatar.jpg')
    expect(state.isAuthenticated).toBe(true)
  })

  // B - Boundaries: logout cleans both memory and persistent storage
  it('B: logout resets all states to null/false and removes item from localStorage', () => {
    // Arrange
    useAuthStore.getState().setAuth('jwt-token-to-remove', mockUser)
    expect(localStorage.getItem('rechat_access_token')).toBe('jwt-token-to-remove')

    // Act
    useAuthStore.getState().logout()

    // Assert
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(localStorage.getItem('rechat_access_token')).toBeNull()
  })

  // E - Exceptions / Error recovery: Token invalid on initializeAuth triggers logout
  it('E: initializeAuth triggers logout when backend rejects stored token (e.g. 401)', async () => {
    // Arrange
    const staleToken = 'stale-or-blacklisted-token'
    localStorage.setItem('rechat_access_token', staleToken)
    useAuthStore.setState({ token: staleToken, isAuthenticated: true })

    vi.mocked(apiClient.get).mockRejectedValueOnce({
      response: { status: 401, data: { message: 'Unauthorized' } },
    })

    // Act
    await useAuthStore.getState().initializeAuth()

    // Assert
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
    expect(localStorage.getItem('rechat_access_token')).toBeNull()
  })

  // S - Simple / Happy Path: initializeAuth hydrations user profile successfully
  it('S: initializeAuth hydrates user profile when token is valid', async () => {
    // Arrange
    const validToken = 'valid-jwt-token'
    localStorage.setItem('rechat_access_token', validToken)
    useAuthStore.setState({ token: validToken, isAuthenticated: true })

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockUser })

    // Act
    await useAuthStore.getState().initializeAuth()

    // Assert
    const state = useAuthStore.getState()
    expect(apiClient.get).toHaveBeenCalledWith('/auth/me')
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })
})
