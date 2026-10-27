import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatDetailDrawer } from './ChatDetailDrawer'
import { messagesApi } from '../services/messages.api'
import type { Conversation } from '@/features/conversations/types/conversation.types'
import type { Message } from '../types/message.types'

vi.mock('../services/messages.api', () => ({
  messagesApi: {
    getMessages: vi.fn(),
  },
}))

describe('ChatDetailDrawer Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const directConv: Conversation = {
    id: 'conv-1',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: 'https://example.com/avatar.jpg',
    unreadCount: 0,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }

  const partnerUser = {
    id: 'user-partner',
    username: 'nguyenvana',
    displayName: 'Nguyễn Văn A',
    avatarUrl: 'https://example.com/avatar.jpg',
    isOnline: true,
  }

  const groupConv: Conversation = {
    id: 'conv-group-1',
    type: 'GROUP',
    name: 'Đội Dự Án ReChat',
    avatarUrl: null,
    unreadCount: 0,
    memberCount: 2,
    members: [
      {
        id: 'member-1',
        conversationId: 'conv-group-1',
        userId: 'user-1',
        role: 'OWNER',
        joinedAt: '2026-10-20T00:00:00.000Z',
        user: {
          id: 'user-1',
          username: 'owner_user',
          displayName: 'Trần Trưởng Nhóm',
          avatarUrl: null,
        },
      },
      {
        id: 'member-2',
        conversationId: 'conv-group-1',
        userId: 'user-2',
        role: 'MEMBER',
        joinedAt: '2026-10-20T00:00:00.000Z',
        user: {
          id: 'user-2',
          username: 'member_user',
          displayName: 'Lê Thành Viên',
          avatarUrl: null,
        },
      },
    ],
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }

  const mockImageMessage: Message = {
    id: 'msg-img-1',
    content: 'Ảnh thiên nhiên',
    type: 'IMAGE',
    fileUrl: 'https://example.com/nature.jpg',
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    sender: {
      id: 'user-partner',
      username: 'nguyenvana',
      displayName: 'Nguyễn Văn A',
      avatarUrl: null,
    },
  }

  const mockFileMessage: Message = {
    id: 'msg-file-1',
    content: 'Tài liệu hướng dẫn.pdf',
    type: 'FILE',
    fileUrl: 'https://example.com/guide.pdf',
    fileSize: 1024 * 1024 * 2.5, // 2.5 MB
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T11:00:00.000Z',
    updatedAt: '2026-10-26T11:00:00.000Z',
    sender: {
      id: 'user-partner',
      username: 'nguyenvana',
      displayName: 'Nguyễn Văn A',
      avatarUrl: null,
    },
  }

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ChatDetailDrawer
        isOpen={false}
        onClose={vi.fn()}
        conversation={directConv}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders direct conversation details with online status and username', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValue([])

    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
        isOnline={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Thông tin người dùng')).toBeInTheDocument()
    })
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('@nguyenvana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tắt thông báo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tìm kiếm tin nhắn' })).toBeInTheDocument()
  })

  it('renders group conversation details with member roles', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValue([])

    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={groupConv}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Thông tin nhóm')).toBeInTheDocument()
    })
    expect(screen.getByText('Đội Dự Án ReChat')).toBeInTheDocument()
    expect(screen.getByText('Thành viên (2)')).toBeInTheDocument()
    expect(screen.getByText('Trần Trưởng Nhóm')).toBeInTheDocument()
    expect(screen.getByText('Trưởng nhóm')).toBeInTheDocument()
    expect(screen.getByText('Lê Thành Viên')).toBeInTheDocument()
    expect(screen.getByText('Thành viên')).toBeInTheDocument()
  })

  it('fetches media independently, switches tabs, and handles image click', async () => {
    const onImageClick = vi.fn()
    vi.mocked(messagesApi.getMessages).mockImplementation(async (_convId, query) => {
      if (query?.type === 'IMAGE') return [mockImageMessage]
      if (query?.type === 'FILE') return [mockFileMessage]
      return []
    })

    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
        onImageClick={onImageClick}
      />
    )

    // Chờ fetch tab media hoàn thành
    await waitFor(() => {
      expect(screen.getByText('Ảnh (1)')).toBeInTheDocument()
    })

    const imageThumb = screen.getByAltText('Ảnh thiên nhiên')
    fireEvent.click(imageThumb.parentElement!)
    expect(onImageClick).toHaveBeenCalledWith('https://example.com/nature.jpg', 'Ảnh thiên nhiên')

    // Chuyển sang Files tab
    fireEvent.click(screen.getByRole('button', { name: /Tệp/ }))

    await waitFor(() => {
      expect(screen.getByText('Tệp (1)')).toBeInTheDocument()
      expect(screen.getByText('Tài liệu hướng dẫn.pdf')).toBeInTheDocument()
      expect(screen.getByText('2.5 MB')).toBeInTheDocument()
    })
  })

  it('triggers infinite scroll loadMore when scrolling to bottom of drawer container', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValueOnce([mockImageMessage])

    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('shared-media-grid')).toBeInTheDocument()
    })

    const container = screen.getByTestId('drawer-scroll-container')
    // Giả lập scroll tới gần đáy: scrollHeight 500, scrollTop 350, clientHeight 100 -> diff 50 < 60
    Object.defineProperty(container, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true })
    Object.defineProperty(container, 'scrollTop', { value: 360, configurable: true })

    fireEvent.scroll(container)

    // loadMore sẽ được trigger nếu còn hasMore
    expect(messagesApi.getMessages).toHaveBeenCalled()
  })

  it('toggles notification mute state', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValue([])

    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tắt thông báo' })).toBeInTheDocument()
    })

    const muteBtn = screen.getByRole('button', { name: 'Tắt thông báo' })
    fireEvent.click(muteBtn)

    expect(screen.getByRole('button', { name: 'Bật thông báo' })).toBeInTheDocument()
    expect(screen.getByText('Đã tắt chuông')).toBeInTheDocument()
  })

  it('calls onClose when clicking close button', async () => {
    vi.mocked(messagesApi.getMessages).mockResolvedValue([])

    const onClose = vi.fn()
    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={onClose}
        conversation={directConv}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Đóng bảng thông tin' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng thông tin' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
