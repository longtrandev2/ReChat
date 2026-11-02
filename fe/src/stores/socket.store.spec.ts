import { describe, it, expect, beforeEach } from 'vitest'
import { useSocketStore } from './socket.store'

describe('useSocketStore Tests', () => {
  beforeEach(() => {
    useSocketStore.getState().reset()
  })

  it('has initial disconnected state with empty presence registry', () => {
    const state = useSocketStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.error).toBeNull()
    expect(state.onlineUsers).toEqual({})
  })

  it('transitions socket status correctly through lifecycle states', () => {
    // 1. Connecting
    useSocketStore.getState().setStatus('connecting')
    expect(useSocketStore.getState().status).toBe('connecting')
    expect(useSocketStore.getState().error).toBeNull()

    // 2. Connected
    useSocketStore.getState().setStatus('connected')
    expect(useSocketStore.getState().status).toBe('connected')

    // 3. Error
    useSocketStore.getState().setStatus('error', 'Connection timeout')
    expect(useSocketStore.getState().status).toBe('error')
    expect(useSocketStore.getState().error).toBe('Connection timeout')

    // 4. Disconnected
    useSocketStore.getState().setStatus('disconnected')
    expect(useSocketStore.getState().status).toBe('disconnected')
  })

  it('tracks user presence status and provides isUserOnline helper', () => {
    const store = useSocketStore.getState()

    // Initially unknown user is offline
    expect(store.isUserOnline('user-1')).toBe(false)

    // User-1 connects -> ONLINE
    useSocketStore.getState().updateUserStatus('user-1', 'ONLINE')
    expect(useSocketStore.getState().isUserOnline('user-1')).toBe(true)
    expect(useSocketStore.getState().onlineUsers['user-1']?.status).toBe('ONLINE')

    // User-1 disconnects -> OFFLINE with lastSeen timestamp
    const timestamp = '2026-10-26T10:00:00.000Z'
    useSocketStore.getState().updateUserStatus('user-1', 'OFFLINE', timestamp)
    expect(useSocketStore.getState().isUserOnline('user-1')).toBe(false)
    expect(useSocketStore.getState().onlineUsers['user-1']?.lastSeen).toBe(timestamp)
  })

  it('resets presence registry and connection state on logout', () => {
    useSocketStore.getState().setStatus('connected')
    useSocketStore.getState().updateUserStatus('user-99', 'ONLINE')

    expect(useSocketStore.getState().status).toBe('connected')
    expect(useSocketStore.getState().isUserOnline('user-99')).toBe(true)

    // Reset
    useSocketStore.getState().reset()

    expect(useSocketStore.getState().status).toBe('disconnected')
    expect(useSocketStore.getState().error).toBeNull()
    expect(useSocketStore.getState().onlineUsers).toEqual({})
    expect(useSocketStore.getState().isUserOnline('user-99')).toBe(false)
  })
})
