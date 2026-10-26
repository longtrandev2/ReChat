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

  it('creates new socket instance on first connect', () => {
    const mockSocket = {
      connected: false,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
    }
    vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket)

    const socket = socketClient.connect('jwt-token-1')

    expect(io).toHaveBeenCalledTimes(1)
    expect(socket).toBe(mockSocket)
    expect(socketClient.getSocket()).toBe(mockSocket)
  })

  it('reuses existing socket instance if token is identical and socket is active or connected', () => {
    const mockSocket = {
      connected: false,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
    }
    vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket)

    // First connect
    socketClient.connect('jwt-token-1')
    expect(io).toHaveBeenCalledTimes(1)

    // Second connect during handshake (active = true, connected = false)
    const socket2 = socketClient.connect('jwt-token-1')
    expect(io).toHaveBeenCalledTimes(1)
    expect(mockSocket.disconnect).not.toHaveBeenCalled()
    expect(socket2).toBe(mockSocket)
  })

  it('disconnects and recreates socket if token changes', () => {
    const mockSocket1 = {
      connected: true,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
    }
    const mockSocket2 = {
      connected: false,
      active: true,
      disconnect: vi.fn(),
      removeAllListeners: vi.fn(),
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
    }
    vi.mocked(io).mockReturnValue(mockSocket as unknown as Socket)

    socketClient.connect('jwt-token-1')
    socketClient.disconnect()

    expect(mockSocket.removeAllListeners).toHaveBeenCalled()
    expect(mockSocket.disconnect).toHaveBeenCalled()
    expect(socketClient.getSocket()).toBeNull()
  })
})
