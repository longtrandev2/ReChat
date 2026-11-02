import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSocketInit, useSocket } from './useSocket'
import { socketClient } from '@/services/socket.client'
import { useAuthStore } from '@/stores/auth.store'
import { useSocketStore } from '@/stores/socket.store'
import { postAuthBroadcast } from '@/lib/auth-broadcast'
import { resetNotificationSoundForTest } from '@/lib/notification-sound'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import type { Socket } from 'socket.io-client'

const toastError = vi.hoisted(() => vi.fn())
vi.mock('sonner', () => ({ toast: { error: toastError } }))

vi.mock('@/services/socket.client', () => ({
  socketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    updateToken: vi.fn(),
    getSocket: vi.fn(),
  },
}))

vi.mock('@/lib/auth-broadcast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-broadcast')>()
  return {
    ...actual,
    postAuthBroadcast: vi.fn(),
  }
})

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

  it('updates onlineUsers presence when receiving userPresence event with isOnline boolean', () => {
    useAuthStore.setState({
      token: 'jwt-valid-token-123',
      isAuthenticated: true,
    })

    renderHook(() => useSocketInit())

    act(() => {
      mockSocketListeners['userPresence']?.({
        userId: 'partner-user-123',
        isOnline: true,
        lastSeen: new Date().toISOString(),
      })
    })

    expect(useSocketStore.getState().isUserOnline('partner-user-123')).toBe(true)

    act(() => {
      mockSocketListeners['userPresence']?.({
        userId: 'partner-user-123',
        isOnline: false,
        lastSeen: new Date().toISOString(),
      })
    })

    expect(useSocketStore.getState().isUserOnline('partner-user-123')).toBe(false)
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

  it('handles FORCE_LOGOUT by disconnecting socket, resetting auth state, and broadcasting logout', () => {
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
    expect(postAuthBroadcast).toHaveBeenCalledWith({ type: 'AUTH_LOGOUT' })
  })

  it('verifies the session on server-initiated disconnect and toasts when it is gone (FR-27)', async () => {
    useAuthStore.setState({ token: 'jwt-active', isAuthenticated: true })
    const checkAuth = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({ token: null, isAuthenticated: false })
    })
    useAuthStore.setState({ checkAuth })

    renderHook(() => useSocketInit())
    await act(async () => {
      mockSocketListeners['disconnect']?.('io server disconnect')
    })

    expect(checkAuth).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('Phiên đăng nhập đã kết thúc trên thiết bị này')
  })

  it('does not verify the session on a plain transport disconnect', async () => {
    useAuthStore.setState({ token: 'jwt-active', isAuthenticated: true })
    const checkAuth = vi.fn()
    useAuthStore.setState({ checkAuth })

    renderHook(() => useSocketInit())
    await act(async () => {
      mockSocketListeners['disconnect']?.('transport close')
    })

    expect(checkAuth).not.toHaveBeenCalled()
  })

  it('prevents concurrent duplicate refresh calls when multiple connect_error events fire rapidly', async () => {
    useAuthStore.setState({
      token: 'jwt-expired-token',
      isAuthenticated: true,
    })

    let resolveRefresh: (() => void) | undefined
    const mockCheckAuth = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = () => {
            useAuthStore.setState({ token: 'new-refreshed-jwt-token' })
            resolve()
          }
        })
    )
    useAuthStore.getState().checkAuth = mockCheckAuth

    renderHook(() => useSocketInit())

    // Trigger first and second connect_error while first is in-flight
    let p1: unknown
    let p2: unknown
    act(() => {
      p1 = mockSocketListeners['connect_error']?.(new Error('Unauthorized: jwt expired'))
      p2 = mockSocketListeners['connect_error']?.(new Error('Unauthorized: jwt expired'))
    })

    // Only 1 checkAuth invocation should happen
    expect(mockCheckAuth).toHaveBeenCalledTimes(1)
    // Status should not flip to generic error
    expect(useSocketStore.getState().status).not.toBe('error')

    // Resolve the first refresh
    await act(async () => {
      resolveRefresh?.()
      await Promise.all([p1, p2])
    })

    expect(socketClient.updateToken).toHaveBeenCalledWith('new-refreshed-jwt-token')
  })

  it('exposes socket store status through useSocket hook', () => {
    useSocketStore.getState().setStatus('connected')
    useSocketStore.getState().updateUserStatus('u1', 'ONLINE')

    const { result } = renderHook(() => useSocket())

    expect(result.current.status).toBe('connected')
    expect(result.current.isConnected).toBe(true)
    expect(result.current.isUserOnline('u1')).toBe(true)
  })
  describe('block events & notification sound', () => {
    const baseConv = {
      id: 'c1',
      type: 'DIRECT' as const,
      name: 'Partner',
      avatarUrl: null,
      unreadCount: 0,
      lastMessage: null,
      lastMessageAt: '2026-10-26T00:00:00.000Z',
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-26T00:00:00.000Z',
      partnerId: 'other',
      isOnline: true,
    }

    const attach = () => {
      useAuthStore.setState({
        token: 'jwt',
        isAuthenticated: true,
        user: { id: 'me' } as never,
      })
      useConversationStore.setState({ conversations: [baseConv] })
      renderHook(() => useSocketInit())
    }

    it('userBlocked where I am the blocker -> BLOCKED_BY_ME and partner offline', () => {
      attach()
      act(() => {
        mockSocketListeners['userBlocked']?.({ blockerId: 'me', blockedId: 'other', conversationId: 'c1' })
      })
      const conv = useConversationStore.getState().conversations[0]
      expect(conv.blockStatus).toBe('BLOCKED_BY_ME')
      expect(conv.isOnline).toBe(false)
    })

    it('userBlocked where I am blocked -> BLOCKED_ME, then userUnblocked -> NONE', () => {
      attach()
      act(() => {
        mockSocketListeners['userBlocked']?.({ blockerId: 'other', blockedId: 'me', conversationId: 'c1' })
      })
      expect(useConversationStore.getState().conversations[0].blockStatus).toBe('BLOCKED_ME')

      act(() => {
        mockSocketListeners['userUnblocked']?.({ blockerId: 'other', blockedId: 'me', conversationId: 'c1' })
      })
      expect(useConversationStore.getState().conversations[0].blockStatus).toBe('NONE')
    })

    it('resolves the DIRECT conversation by partner id when conversationId is null', () => {
      attach()
      act(() => {
        mockSocketListeners['userBlocked']?.({ blockerId: 'me', blockedId: 'other', conversationId: null })
      })
      expect(useConversationStore.getState().conversations[0].blockStatus).toBe('BLOCKED_BY_ME')
    })

    it('ignores block events for unknown conversations', () => {
      attach()
      act(() => {
        mockSocketListeners['userBlocked']?.({ blockerId: 'me', blockedId: 'stranger', conversationId: 'nope' })
      })
      expect(useConversationStore.getState().conversations[0].blockStatus).toBeUndefined()
    })

    it('reuses a single AudioContext across incoming messages', () => {
      const makeCtx = () => ({
        state: 'running',
        currentTime: 0,
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
        createOscillator: () => ({
          connect: vi.fn(),
          frequency: { setValueAtTime: vi.fn() },
          start: vi.fn(),
          stop: vi.fn(),
          type: 'sine',
        }),
        createGain: () => ({
          connect: vi.fn(),
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        }),
      })
      const Ctor = vi.fn(function () {
        return makeCtx()
      })
      Object.defineProperty(window, 'AudioContext', { value: Ctor, configurable: true, writable: true })
      resetNotificationSoundForTest()

      attach()
      const incoming = (id: string) => ({
        id,
        conversationId: 'c1',
        content: 'hello',
        type: 'TEXT',
        createdAt: '2026-11-01T00:00:00.000Z',
        sender: { id: 'other', username: 'o', displayName: 'O', avatarUrl: null },
      })
      act(() => {
        mockSocketListeners['newMessage']?.(incoming('m1'))
        mockSocketListeners['newMessage']?.(incoming('m2'))
        mockSocketListeners['newMessage']?.(incoming('m3'))
      })

      expect(Ctor).toHaveBeenCalledTimes(1)
      resetNotificationSoundForTest()
    })
  })
})
