import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSocketInit, useSocket } from './useSocket'
import { socketClient } from '@/services/socket.client'
import { useAuthStore } from '@/stores/auth.store'
import { useSocketStore } from '@/stores/socket.store'
import type { Socket } from 'socket.io-client'

vi.mock('@/services/socket.client', () => ({
  socketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    updateToken: vi.fn(),
    getSocket: vi.fn(),
  },
}))

interface MockSocket {
  connected: boolean
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
}

describe('useSocket & useSocketInit (Task 7.2)', () => {
  let mockSocketListeners: Record<string, (payload?: unknown) => void> = {}
  let mockSocket: MockSocket

  beforeEach(() => {
    vi.clearAllMocks()
    mockSocketListeners = {}
    mockSocket = {
      connected: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        mockSocketListeners[event] = handler
      }),
      off: vi.fn((event: string) => {
        delete mockSocketListeners[event]
      }),
    }

    vi.mocked(socketClient.connect).mockReturnValue(mockSocket as unknown as Socket)
    useSocketStore.getState().reset()
    useAuthStore.setState({
      token: null,
      user: null,
      isAuthenticated: false,
      isInitializing: false,
    })
  })

  it('does not connect socket when user is unauthenticated', () => {
    renderHook(() => useSocketInit())

    expect(socketClient.connect).not.toHaveBeenCalled()
    expect(socketClient.disconnect).toHaveBeenCalled()
    expect(useSocketStore.getState().status).toBe('disconnected')
  })

  it('connects socket and attaches listeners when user is authenticated with token', () => {
    useAuthStore.setState({
      token: 'jwt-valid-token-123',
      isAuthenticated: true,
    })

    renderHook(() => useSocketInit())

    expect(socketClient.connect).toHaveBeenCalledWith('jwt-valid-token-123')
    expect(useSocketStore.getState().status).toBe('connecting')
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('FORCE_LOGOUT', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('auth_error', expect.any(Function))

    // Simulate socket connected
    act(() => {
      mockSocketListeners['connect']?.()
    })
    expect(useSocketStore.getState().status).toBe('connected')
  })

  it('handles connect_error by triggering silent refresh and updating socket token', async () => {
    useAuthStore.setState({
      token: 'jwt-expired-token',
      isAuthenticated: true,
    })

    const mockCheckAuth = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ token: 'new-refreshed-jwt-token' })
    })
    useAuthStore.getState().checkAuth = mockCheckAuth

    renderHook(() => useSocketInit())

    // Simulate connect_error with expired jwt message
    await act(async () => {
      await mockSocketListeners['connect_error']?.(new Error('Unauthorized: jwt expired'))
    })

    expect(mockCheckAuth).toHaveBeenCalledTimes(1)
    expect(socketClient.updateToken).toHaveBeenCalledWith('new-refreshed-jwt-token')
    expect(mockSocket.connect).toHaveBeenCalled()
  })

  it('handles FORCE_LOGOUT by disconnecting socket and resetting auth state', () => {
    useAuthStore.setState({
      token: 'jwt-active',
      isAuthenticated: true,
    })

    renderHook(() => useSocketInit())

    act(() => {
      mockSocketListeners['FORCE_LOGOUT']?.({ reason: 'Remote logout by user' })
    })

    expect(socketClient.disconnect).toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useSocketStore.getState().status).toBe('disconnected')
  })

  it('exposes socket store status through useSocket hook', () => {
    useSocketStore.getState().setStatus('connected')
    useSocketStore.getState().updateUserStatus('u1', 'ONLINE')

    const { result } = renderHook(() => useSocket())

    expect(result.current.status).toBe('connected')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.isUserOnline('u1')).toBe(true)
  })
})
