import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatDetailDrawer } from './ChatDetailDrawer'
import type { Conversation } from '@/features/conversations/types/conversation.types'
import type { Message } from '../types/message.types'

describe('ChatDetailDrawer Component Tests', () => {
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

  const mockMessages: Message[] = [
    {
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
    },
    {
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
    },
    {
      id: 'msg-text-1',
      content: 'Tin nhắn văn bản bình thường',
      type: 'TEXT',
      fileUrl: null,
      replyToId: null,
      isRecalled: false,
      createdAt: '2026-10-26T12:00:00.000Z',
      updatedAt: '2026-10-26T12:00:00.000Z',
      sender: {
        id: 'user-partner',
        username: 'nguyenvana',
        displayName: 'Nguyễn Văn A',
        avatarUrl: null,
      },
    },
  ]

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ChatDetailDrawer
        isOpen={false}
        onClose={vi.fn()}
        conversation={directConv}
        messages={mockMessages}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders direct conversation details with online status and username', () => {
    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
        isOnline={true}
        messages={mockMessages}
      />
    )

    expect(screen.getByText('Thông tin người dùng')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('@nguyenvana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tắt thông báo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tìm kiếm tin nhắn' })).toBeInTheDocument()
  })

  it('renders group conversation details with member roles', () => {
    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={groupConv}
        messages={mockMessages}
      />
    )

    expect(screen.getByText('Thông tin nhóm')).toBeInTheDocument()
    expect(screen.getByText('Đội Dự Án ReChat')).toBeInTheDocument()
    expect(screen.getByText('Thành viên (2)')).toBeInTheDocument()
    expect(screen.getByText('Trần Trưởng Nhóm')).toBeInTheDocument()
    expect(screen.getByText('Trưởng nhóm')).toBeInTheDocument()
    expect(screen.getByText('Lê Thành Viên')).toBeInTheDocument()
    expect(screen.getByText('Thành viên')).toBeInTheDocument()
  })

  it('switches between Photos and Files tabs and triggers image click', () => {
    const onImageClick = vi.fn()

    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
        messages={mockMessages}
        onImageClick={onImageClick}
      />
    )

    // Media tab is active by default
    expect(screen.getByText('Ảnh (1)')).toBeInTheDocument()
    expect(screen.getByText('Tệp (1)')).toBeInTheDocument()

    const mediaGrid = screen.getByTestId('shared-media-grid')
    expect(mediaGrid).toBeInTheDocument()

    const imageThumb = screen.getByAltText('Ảnh thiên nhiên')
    fireEvent.click(imageThumb.parentElement!)
    expect(onImageClick).toHaveBeenCalledWith('https://example.com/nature.jpg', 'Ảnh thiên nhiên')

    // Switch to Files tab
    fireEvent.click(screen.getByRole('button', { name: /Tệp \(1\)/ }))
    expect(screen.getByTestId('shared-files-list')).toBeInTheDocument()
    expect(screen.getByText('Tài liệu hướng dẫn.pdf')).toBeInTheDocument()
    expect(screen.getByText('2.5 MB')).toBeInTheDocument()
  })

  it('toggles notification mute state', () => {
    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={vi.fn()}
        conversation={directConv}
        partner={partnerUser}
        messages={mockMessages}
      />
    )

    const muteBtn = screen.getByRole('button', { name: 'Tắt thông báo' })
    fireEvent.click(muteBtn)

    expect(screen.getByRole('button', { name: 'Bật thông báo' })).toBeInTheDocument()
    expect(screen.getByText('Đã tắt chuông')).toBeInTheDocument()
  })

  it('calls onClose when clicking close button', () => {
    const onClose = vi.fn()
    render(
      <ChatDetailDrawer
        isOpen={true}
        onClose={onClose}
        conversation={directConv}
        messages={mockMessages}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Đóng bảng thông tin' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
