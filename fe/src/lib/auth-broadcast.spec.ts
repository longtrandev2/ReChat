import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AUTH_BROADCAST_CHANNEL_NAME,
  getBroadcastChannel,
  postAuthBroadcast,
  subscribeToAuthBroadcast,
  closeAuthBroadcast,
  type AuthBroadcastMessage,
} from './auth-broadcast'
import type { UserProfile } from '@/types/auth.types'

const mockUser: UserProfile = {
  id: 'u1',
  username: 'alice',
  email: 'alice@example.com',
  isEmailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-01-01',
}

describe('auth-broadcast utility', () => {
  let mockPostMessage: ReturnType<typeof vi.fn>
  let mockClose: ReturnType<typeof vi.fn>
  let mockAddEventListener: ReturnType<typeof vi.fn>
  let mockRemoveEventListener: ReturnType<typeof vi.fn>
  let eventListeners: Record<string, EventListener> = {}

  beforeEach(() => {
    eventListeners = {}
    mockPostMessage = vi.fn()
    mockClose = vi.fn()
    mockAddEventListener = vi.fn((event, handler) => {
      eventListeners[event] = handler
    })
    mockRemoveEventListener = vi.fn((event) => {
      delete eventListeners[event]
    })

    // Mock global BroadcastChannel class
    class MockBroadcastChannel {
      name: string
      constructor(name: string) {
        this.name = name
      }
      postMessage = mockPostMessage
      close = mockClose
      addEventListener = mockAddEventListener
      removeEventListener = mockRemoveEventListener
    }

    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel)
    closeAuthBroadcast()
  })

  afterEach(() => {
    closeAuthBroadcast()
    vi.unstubAllGlobals()
  })

  it('creates and returns a singleton BroadcastChannel with the correct channel name', () => {
    const channel1 = getBroadcastChannel()
    const channel2 = getBroadcastChannel()

    expect(channel1).toBeDefined()
    expect(channel1?.name).toBe(AUTH_BROADCAST_CHANNEL_NAME)
    expect(channel1).toBe(channel2)
  })

  it('handles environments where BroadcastChannel is undefined gracefully', () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    closeAuthBroadcast()

    expect(getBroadcastChannel()).toBeNull()

    // Calling postAuthBroadcast should not throw
    expect(() => {
      postAuthBroadcast({ type: 'AUTH_LOGOUT' })
    }).not.toThrow()
  })

  it('posts broadcast messages to the channel', () => {
    const message: AuthBroadcastMessage = {
      type: 'AUTH_LOGIN',
      payload: {
        token: 'new-jwt-token-123',
        user: mockUser,
      },
    }

    postAuthBroadcast(message)
    expect(mockPostMessage).toHaveBeenCalledTimes(1)
    expect(mockPostMessage).toHaveBeenCalledWith(message)
  })

  it('subscribes to message events and notifies listener when message is received', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAuthBroadcast(listener)

    expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function))

    // Simulate incoming broadcast event
    const incomingEvent = {
      data: {
        type: 'AUTH_TOKEN_REFRESHED',
        payload: {
          token: 'rotated-token-456',
          user: mockUser,
        },
      },
    }
    eventListeners['message']?.(incomingEvent as unknown as Event)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(incomingEvent.data)

    // Unsubscribe removes listener
    unsubscribe()
    expect(mockRemoveEventListener).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('ignores invalid or malformed message data in listener', () => {
    const listener = vi.fn()
    subscribeToAuthBroadcast(listener)

    // Simulate non-object or missing type event
    eventListeners['message']?.({ data: null } as unknown as Event)
    eventListeners['message']?.({ data: 'string-instead-of-object' } as unknown as Event)
    eventListeners['message']?.({ data: { otherProp: 123 } } as unknown as Event)

    expect(listener).not.toHaveBeenCalled()
  })

  it('closes channel instance properly', () => {
    const channel = getBroadcastChannel()
    expect(channel).toBeDefined()

    closeAuthBroadcast()
    expect(mockClose).toHaveBeenCalledTimes(1)
  })
})
