import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { toast } from 'sonner'
import { ActiveChatCanvas } from './ActiveChatCanvas'
import { useConversationStore } from '@/features/conversations/stores/conversation.store'
import { useMessagesStore } from '../stores/messages.store'
import { useAuthStore } from '@/stores/auth.store'
import { socketClient } from '@/services/socket.client'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import { friendsApi } from '@/features/friends/services/friends.api'
import type { Conversation } from '@/features/conversations/types/conversation.types'
import type { Socket } from 'socket.io-client'

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/services/socket.client', () => ({
  socketClient: { getSocket: vi.fn() },
}))

vi.mock('@/features/conversations/services/conversation.api', () => ({
  conversationApi: {
    getConversationById: vi.fn(),
    getPinnedMessages: vi.fn(),
    togglePin: vi.fn(),
    clearHistory: vi.fn(),
  },
}))

vi.mock('@/features/friends/services/friends.api', () => ({
  friendsApi: {
    blockUser: vi.fn(),
    unblockUser: vi.fn(),
    getBlockedUsers: vi.fn(),
  },
}))

const directConv: Conversation = {
  id: 'conv-1',
  type: 'DIRECT',
  name: 'Nguyễn Văn A',
  avatarUrl: null,
  unreadCount: 0,
  lastMessage: null,
  lastMessageAt: '2026-10-26T00:00:00.000Z',
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
  partnerId: 'partner-1',
  isOnline: true,
  blockStatus: 'NONE',
}

function renderCanvas() {
  return render(
    <MemoryRouter initialEntries={['/chat/conv-1']}>
      <Routes>
        <Route path="/chat/:conversationId" element={<ActiveChatCanvas />} />
        <Route path="/chat" element={<div data-testid="chat-home" />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ActiveChatCanvas - block lock, menu actions, realtime join', () => {
  let socketHandlers: Record<string, (payload?: unknown) => void>
  let mockSocket: { connected: boolean; emit: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn>; off: ReturnType<typeof vi.fn> }

  const openMenuItem = async (user: ReturnType<typeof userEvent.setup>, name: RegExp | string) => {
    await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
    await user.click(await screen.findByRole('menuitem', { name }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
    socketHandlers = {}
    mockSocket = {
      connected: true,
      emit: vi.fn(),
      on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        socketHandlers[event] = handler
      }),
      off: vi.fn(),
    }
    vi.mocked(socketClient.getSocket).mockReturnValue(mockSocket as unknown as Socket)
    vi.mocked(conversationApi.getConversationById).mockResolvedValue(null as unknown as Conversation)
    vi.mocked(conversationApi.getPinnedMessages).mockResolvedValue([])
    vi.mocked(friendsApi.getBlockedUsers).mockResolvedValue([])

    useAuthStore.setState({
      user: { id: 'me', username: 'me', displayName: 'Tôi' } as never,
      isAuthenticated: true,
      token: 't',
    })
    useConversationStore.setState({
      conversations: [directConv],
      activeConversationId: null,
      setActiveConversation: vi.fn(),
    })
    useMessagesStore.setState({
      messagesByConversation: { 'conv-1': [] },
      hasMoreByConversation: {},
      typingUsers: {},
      isLoadingMessages: false,
      fetchMessages: vi.fn(),
    })
  })

  describe('BR-38 composer lock', () => {
    it('BLOCKED_BY_ME: shows banner + unblock button, hides composer and online status', () => {
      useConversationStore.setState({ conversations: [{ ...directConv, blockStatus: 'BLOCKED_BY_ME' }] })
      renderCanvas()

      expect(screen.getByText('Bạn đã chặn người dùng này')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Bỏ chặn' })).toBeInTheDocument()
      expect(screen.queryByLabelText('Nội dung tin nhắn')).not.toBeInTheDocument()
      expect(screen.queryByText('Đang trực tuyến')).not.toBeInTheDocument()
    })

    it('BLOCKED_ME: shows locked bar without any action', () => {
      useConversationStore.setState({ conversations: [{ ...directConv, blockStatus: 'BLOCKED_ME' }] })
      renderCanvas()

      expect(screen.getByText('Bạn không thể gửi tin nhắn cho người này')).toBeInTheDocument()
      expect(screen.queryByTestId('unblock-button')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Nội dung tin nhắn')).not.toBeInTheDocument()
    })

    it('"Bỏ chặn" calls unblock API then restores the composer', async () => {
      const user = userEvent.setup()
      vi.mocked(friendsApi.unblockUser).mockResolvedValue({ message: 'ok' })
      useConversationStore.setState({ conversations: [{ ...directConv, blockStatus: 'BLOCKED_BY_ME' }] })
      renderCanvas()

      await user.click(screen.getByTestId('unblock-button'))

      await waitFor(() => expect(friendsApi.unblockUser).toHaveBeenCalledWith('partner-1'))
      expect(await screen.findByLabelText('Nội dung tin nhắn')).toBeInTheDocument()
      expect(useConversationStore.getState().conversations[0].blockStatus).toBe('NONE')
    })

    it('realtime store update (socket userBlocked) locks an open chat', () => {
      renderCanvas()
      expect(screen.getByLabelText('Nội dung tin nhắn')).toBeInTheDocument()

      act(() => {
        useConversationStore.getState().updateConversation('conv-1', { blockStatus: 'BLOCKED_ME' })
      })

      expect(screen.getByTestId('blocked-me-bar')).toBeInTheDocument()
      expect(screen.queryByLabelText('Nội dung tin nhắn')).not.toBeInTheDocument()
    })

    it('403 CONVERSATION_BLOCKED exception switches to locked state with a toast', () => {
      renderCanvas()

      act(() => {
        socketHandlers['exception']?.({ status: 'error', errorCode: 'CONVERSATION_BLOCKED', message: 'blocked' })
      })

      expect(screen.getByTestId('blocked-me-bar')).toBeInTheDocument()
      expect(toast.error).toHaveBeenCalled()
    })

    it('ignores unrelated socket exceptions', () => {
      renderCanvas()

      act(() => {
        socketHandlers['exception']?.({ status: 'error', message: 'Something else' })
      })

      expect(screen.getByLabelText('Nội dung tin nhắn')).toBeInTheDocument()
    })
  })

  describe('FR-48 header menu', () => {
    it('pins the conversation (API + store) and then offers "Bỏ ghim"', async () => {
      const user = userEvent.setup()
      vi.mocked(conversationApi.togglePin).mockResolvedValue({
        conversationId: 'conv-1',
        isPinned: true,
        pinnedAt: '2026-11-01T00:00:00.000Z',
      })
      renderCanvas()

      await openMenuItem(user, 'Ghim cuộc trò chuyện')

      await waitFor(() => expect(conversationApi.togglePin).toHaveBeenCalledWith('conv-1', true))
      expect(useConversationStore.getState().conversations[0].isPinned).toBe(true)
      expect(toast.success).toHaveBeenCalledWith('Đã ghim cuộc trò chuyện')

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      expect(await screen.findByRole('menuitem', { name: 'Bỏ ghim' })).toBeInTheDocument()
    })

    it('rolls back and toasts the server message when pin fails (limit 5)', async () => {
      const user = userEvent.setup()
      vi.mocked(conversationApi.togglePin).mockRejectedValue({
        response: { status: 400, data: { message: 'Chỉ được ghim tối đa 5 cuộc trò chuyện' } },
      })
      renderCanvas()

      await openMenuItem(user, 'Ghim cuộc trò chuyện')

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Chỉ được ghim tối đa 5 cuộc trò chuyện'))
      expect(useConversationStore.getState().conversations[0].isPinned).toBeFalsy()
    })

    it('clear history: confirm dialog -> API -> local messages cleared, removed from inbox, navigate /chat', async () => {
      const user = userEvent.setup()
      vi.mocked(conversationApi.clearHistory).mockResolvedValue({
        conversationId: 'conv-1',
        clearedAt: '2026-11-01T00:00:00.000Z',
      })
      renderCanvas()

      await openMenuItem(user, 'Xóa đoạn chat')
      // Chưa gọi API trước khi xác nhận
      expect(conversationApi.clearHistory).not.toHaveBeenCalled()
      await user.click(await screen.findByTestId('confirm-clear-history-submit'))

      await waitFor(() => expect(conversationApi.clearHistory).toHaveBeenCalledWith('conv-1'))
      expect(await screen.findByTestId('chat-home')).toBeInTheDocument()
      expect(useConversationStore.getState().conversations).toHaveLength(0)
      expect(useMessagesStore.getState().messagesByConversation['conv-1']).toBeUndefined()
    })

    it('does not clear anything when the clear API fails', async () => {
      const user = userEvent.setup()
      vi.mocked(conversationApi.clearHistory).mockRejectedValue(new Error('boom'))
      renderCanvas()

      await openMenuItem(user, 'Xóa đoạn chat')
      await user.click(await screen.findByTestId('confirm-clear-history-submit'))

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không thể xóa đoạn chat'))
      expect(useConversationStore.getState().conversations).toHaveLength(1)
      expect(screen.queryByTestId('chat-home')).not.toBeInTheDocument()
    })

    it('block via menu: confirm -> friends API -> composer locked as BLOCKED_BY_ME', async () => {
      const user = userEvent.setup()
      vi.mocked(friendsApi.blockUser).mockResolvedValue({ message: 'ok' })
      renderCanvas()

      await openMenuItem(user, 'Chặn người dùng')
      await user.click(await screen.findByTestId('confirm-block-user-submit'))

      await waitFor(() => expect(friendsApi.blockUser).toHaveBeenCalledWith('partner-1'))
      expect(await screen.findByTestId('blocked-by-me-bar')).toBeInTheDocument()
    })
  })

  describe('realtime room join', () => {
    it('joins immediately when connected and re-joins on every socket "connect" (reconnect)', () => {
      renderCanvas()
      const joins = () =>
        mockSocket.emit.mock.calls.filter(([evt]) => evt === 'joinConversation').length
      expect(joins()).toBe(1)

      act(() => socketHandlers['connect']?.())
      expect(joins()).toBe(2)
      expect(mockSocket.emit).toHaveBeenCalledWith('joinConversation', { conversationId: 'conv-1' })
    })

    it('joins once the socket connects when it was not connected on mount', () => {
      mockSocket.connected = false
      renderCanvas()
      expect(mockSocket.emit).not.toHaveBeenCalledWith('joinConversation', expect.anything())

      mockSocket.connected = true
      act(() => socketHandlers['connect']?.())
      expect(mockSocket.emit).toHaveBeenCalledWith('joinConversation', { conversationId: 'conv-1' })
    })

    it('removes the connect listener and leaves the room on unmount', () => {
      const { unmount } = renderCanvas()
      unmount()

      expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function))
      expect(mockSocket.emit).toHaveBeenCalledWith('leaveConversation', { conversationId: 'conv-1' })
    })
  })
})
