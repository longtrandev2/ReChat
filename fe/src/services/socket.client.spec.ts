import { describe, it, expect, vi, beforeEach } from 'vitest'
import { socketClient } from './socket.client'
import { io, type Socket } from 'socket.io-client'

vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}))

describe('socketClient Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    socketClient.disconnect()
  })

  it('creates new socket instance on first connect and configures dynamic auth callback', () => {
    let capturedAuth: ((cb: (data: object) => void) => void) | object | undefined
    const mockSocket = {
      connected: false,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      auth: {},
    }
    vi.mocked(io).mockImplementation((_url, options) => {
      capturedAuth = options?.auth
      return mockSocket as unknown as Socket
    })

    const socket = socketClient.connect('jwt-token-1')

    expect(io).toHaveBeenCalledTimes(1)
    expect(socket).toBe(mockSocket)
    expect(socketClient.getSocket()).toBe(mockSocket)

    // Verify dynamic auth callback
    expect(typeof capturedAuth).toBe('function')
    const authCb = vi.fn()
    if (typeof capturedAuth === 'function') {
      capturedAuth(authCb)
    }
    expect(authCb).toHaveBeenCalledWith({ token: 'Bearer jwt-token-1' })
  })

  it('reuses existing socket instance and updates auth if socket is active or connected', () => {
    const mockSocket = {
      connected: true,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      auth: {},
    }
    vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket)

    // First connect
    socketClient.connect('jwt-token-1')
    expect(io).toHaveBeenCalledTimes(1)

    // Second connect with new token while still active
    const socket2 = socketClient.connect('jwt-token-2')
    expect(io).toHaveBeenCalledTimes(1) // Does not tear down or re-invoke io()
    expect(mockSocket.disconnect).not.toHaveBeenCalled()
    expect(socket2).toBe(mockSocket)
    expect(mockSocket.auth).toEqual({ token: 'Bearer jwt-token-2' })
  })

  it('updateToken updates currentToken and socket.auth directly', () => {
    const mockSocket = {
      connected: true,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      auth: {},
    }
    vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket)

    socketClient.connect('jwt-token-initial')
    socketClient.updateToken('jwt-token-updated')

    expect(mockSocket.auth).toEqual({ token: 'Bearer jwt-token-updated' })
  })

  it('disconnects and recreates socket if existing socket is completely inactive', () => {
    const mockSocket1 = {
      connected: false,
      active: false,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      auth: {},
    }
    const mockSocket2 = {
      connected: false,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      auth: {},
    }
    vi.mocked(io)
      .mockReturnValueOnce(mockSocket1 as unknown as Socket)
      .mockReturnValueOnce(mockSocket2 as unknown as Socket)

    socketClient.connect('jwt-token-1')
    socketClient.connect('jwt-token-2')

    expect(mockSocket1.removeAllListeners).toHaveBeenCalled()
    expect(mockSocket1.disconnect).toHaveBeenCalled()
    expect(io).toHaveBeenCalledTimes(2)
  })

  it('cleans up resources and listeners on disconnect()', () => {
    const mockSocket = {
      connected: true,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
      auth: {},
    }
    vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket)

    socketClient.connect('jwt-token-1')
    socketClient.disconnect()

    expect(mockSocket.removeAllListeners).toHaveBeenCalled()
    expect(mockSocket.disconnect).toHaveBeenCalled()
    expect(socketClient.getSocket()).toBeNull()
  })
})
