import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ActiveChatCanvas } from './ActiveChatCanvas'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { useMessagesStore } from '../stores/messages.store'
import { useAuthStore } from '@/stores/auth.store'
import { socketClient } from '@/services/socket.client'
import type { Conversation } from '@/features/conversations/types/conversation.types'
import type { Message } from '../types/message.types'
import type { Socket } from 'socket.io-client'

vi.mock('@/services/socket.client', () => ({
  socketClient: {
    getSocket: vi.fn(),
  },
}))

vi.mock('@/features/conversations/services/conversation.api', () => ({
  conversationApi: {
    getConversationById: vi.fn().mockResolvedValue(null),
    getPinnedMessages: vi.fn().mockResolvedValue([]),
    pinMessage: vi.fn().mockResolvedValue(undefined),
    unpinMessage: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('ActiveChatCanvas Component Tests', () => {
  const mockSocket = {
    connected: true,
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }

  const mockConv: Conversation = {
    id: 'conv-test-1',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: null,
    unreadCount: 1,
    lastMessage: null,
    lastMessageAt: '2026-10-26T00:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }

  const mockMsg: Message = {
    id: 'msg-1',
    content: 'Tin nhắn chào bạn',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    sender: {
      id: 'sender-1',
      username: 'user1',
      displayName: 'Nguyễn Văn A',
      avatarUrl: null,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket as unknown as Socket)

    useAuthStore.setState({
      user: {
        id: 'my-user-id',
        username: 'myuser',
        displayName: 'Tôi',
        email: 'me@example.com',
        avatarUrl: undefined,
        isEmailVerified: true,
        twoFactorEnabled: false,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
      isAuthenticated: true,
      token: 'mock-token',
    })

    useConversationStore.setState({
      conversations: [mockConv],
      activeConversationId: null,
      markConversationAsRead: vi.fn(),
      setActiveConversation: vi.fn(),
    })

    useMessagesStore.setState({
      messagesByConversation: {
        'conv-test-1': [mockMsg],
      },
      hasMoreByConversation: {
        'conv-test-1': false,
      },
      typingUsers: {},
      isLoadingMessages: false,
      error: null,
      fetchMessages: vi.fn(),
    })
  })

  it('renders loading state when conversation is not found in store', () => {
    render(
      <MemoryRouter initialEntries={['/chat/unknown-conv']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('chat-canvas-loading')).toBeInTheDocument()
    expect(screen.getByText('Đang tải cuộc trò chuyện...')).toBeInTheDocument()
  })

  it('renders header, feed, and composer when conversation exists', () => {
    render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('active-chat-canvas')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Tin nhắn chào bạn')).toBeInTheDocument()
    expect(screen.getByLabelText('Nội dung tin nhắn')).toBeInTheDocument()
  })

  it('joins room on mount and leaves room on unmount', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    expect(mockSocket.emit).toHaveBeenCalledWith('joinConversation', {
      conversationId: 'conv-test-1',
    })

    unmount()

    expect(mockSocket.emit).toHaveBeenCalledWith('leaveConversation', {
      conversationId: 'conv-test-1',
    })
  })

  it('sends message via socket when composer triggers send', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    const textarea = screen.getByLabelText('Nội dung tin nhắn')
    fireEvent.change(textarea, { target: { value: 'Tin nhắn gửi test' } })

    const sendButton = screen.getByRole('button', { name: 'Gửi tin nhắn' })
    await act(async () => {
      fireEvent.click(sendButton)
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('sendMessage', {
      conversationId: 'conv-test-1',
      content: 'Tin nhắn gửi test',
      type: 'TEXT',
    })
  })

  it('registers and unregisters socket listeners for rich messaging', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    expect(mockSocket.on).toHaveBeenCalledWith('messageRecalled', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('messageEdited', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('messageReactionUpdated', expect.any(Function))

    unmount()

    expect(mockSocket.off).toHaveBeenCalledWith('messageRecalled', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('messageEdited', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('messageReactionUpdated', expect.any(Function))
  })

  it('toggles ChatDetailDrawer when clicking info button and closes when clicking close', () => {
    render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    // Drawer is initially closed
    expect(screen.queryByTestId('chat-detail-drawer')).not.toBeInTheDocument()

    // Click info button in header
    const infoBtn = screen.getByRole('button', { name: 'Thông tin hội thoại' })
    fireEvent.click(infoBtn)

    // Drawer opens
    expect(screen.getByTestId('chat-detail-drawer')).toBeInTheDocument()
    expect(screen.getByText('Thông tin người dùng')).toBeInTheDocument()

    // Click close button on drawer
    const closeBtn = screen.getByRole('button', { name: 'Đóng bảng thông tin' })
    fireEvent.click(closeBtn)

    // Drawer closes
    expect(screen.queryByTestId('chat-detail-drawer')).not.toBeInTheDocument()
  })

  it('shows drag-and-drop overlay on drag enter and hides on drag leave or drop', () => {
    render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    const canvas = screen.getByTestId('active-chat-canvas')
    expect(screen.queryByTestId('drag-drop-overlay')).not.toBeInTheDocument()

    // Trigger drag enter with Files
    fireEvent.dragEnter(canvas, {
      dataTransfer: {
        types: ['Files'],
      },
    })
    expect(screen.getByTestId('drag-drop-overlay')).toBeInTheDocument()
    expect(screen.getByText('Thả tệp vào đây để gửi')).toBeInTheDocument()

    // Trigger drag leave
    fireEvent.dragLeave(canvas)
    expect(screen.queryByTestId('drag-drop-overlay')).not.toBeInTheDocument()

    // Trigger drag enter then drop
    fireEvent.dragEnter(canvas, {
      dataTransfer: {
        types: ['Files'],
      },
    })
    expect(screen.getByTestId('drag-drop-overlay')).toBeInTheDocument()

    const testFile = new File(['readme'], 'README.md', { type: 'text/markdown' })
    fireEvent.drop(canvas, {
      dataTransfer: {
        files: [testFile],
      },
    })
    expect(screen.queryByTestId('drag-drop-overlay')).not.toBeInTheDocument()
  })

  it('fetches and renders PinnedMessageBar when pinned messages exist', async () => {
    const { conversationApi } = await import('@/features/conversations/services/conversation.api')
    const pinnedMsg: Message = {
      ...mockMsg,
      id: 'pinned-1',
      content: 'Nội dung đã được ghim',
      isPinned: true,
    }
    vi.mocked(conversationApi.getPinnedMessages).mockResolvedValueOnce([pinnedMsg])

    render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    const pinnedBar = await screen.findByTestId('pinned-message-bar')
    expect(pinnedBar).toBeInTheDocument()
    expect(screen.getByText('Nội dung đã được ghim')).toBeInTheDocument()
  })

  it('updates pinned messages on messagePinned and messageUnpinned socket events', async () => {
    let messagePinnedCallback: ((payload: unknown) => void) | undefined
    let messageUnpinnedCallback: ((payload: unknown) => void) | undefined

    mockSocket.on.mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
      if (event === 'messagePinned') {
        messagePinnedCallback = cb as (payload: unknown) => void
      }
      if (event === 'messageUnpinned') {
        messageUnpinnedCallback = cb as (payload: unknown) => void
      }
    })

    render(
      <MemoryRouter initialEntries={['/chat/conv-test-1']}>
        <Routes>
          <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        </Routes>
      </MemoryRouter>
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByTestId('pinned-message-bar')).not.toBeInTheDocument()

    // Trigger messagePinned socket event
    const newPin: Message = {
      ...mockMsg,
      id: 'socket-pin-1',
      content: 'Tin ghim từ socket',
      isPinned: true,
    }
    await act(async () => {
      messagePinnedCallback?.({
        conversationId: 'conv-test-1',
        messageId: 'socket-pin-1',
        message: newPin,
        pinnedBy: { id: 'sender-1', displayName: 'Nguyễn Văn A' },
      })
    })

    const pinnedBar = await screen.findByTestId('pinned-message-bar')
    expect(pinnedBar).toBeInTheDocument()
    expect(screen.getByText('Tin ghim từ socket')).toBeInTheDocument()

    // Trigger messageUnpinned socket event
    act(() => {
      messageUnpinnedCallback?.({
        conversationId: 'conv-test-1',
        messageId: 'socket-pin-1',
      })
    })

    expect(screen.queryByTestId('pinned-message-bar')).not.toBeInTheDocument()
  })
})

