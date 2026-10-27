import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatHeader } from './ChatHeader'
import type { Conversation } from '@/features/conversations/types/conversation.types'

describe('ChatHeader Component Tests', () => {
  const directConv: Conversation = {
    id: 'conv-1',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: null,
    unreadCount: 0,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }

  const groupConv: Conversation = {
    id: 'conv-2',
    type: 'GROUP',
    name: 'Nhóm Dự Án ReChat',
    avatarUrl: null,
    unreadCount: 0,
    memberCount: 5,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }

  it('renders direct conversation with online status', () => {
    render(<ChatHeader conversation={directConv} isOnline={true} />)

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByText('Đang trực tuyến')).toBeInTheDocument()
    expect(screen.getByText('NV')).toBeInTheDocument()
  })

  it('renders offline status when isOnline is false', () => {
    render(<ChatHeader conversation={directConv} isOnline={false} />)

    expect(screen.getByText('Ngoại tuyến')).toBeInTheDocument()
  })

  it('renders group conversation with member count', () => {
    render(<ChatHeader conversation={groupConv} />)

    expect(screen.getByText('Nhóm Dự Án ReChat')).toBeInTheDocument()
    expect(screen.getByText('5 thành viên')).toBeInTheDocument()
  })

  it('renders typing indicator when typingUserNames is provided', () => {
    render(
      <ChatHeader
        conversation={directConv}
        isOnline={true}
        typingUserNames={['Lê Thị B']}
      />
    )

    expect(screen.getByText('Lê Thị B đang soạn tin nhắn...')).toBeInTheDocument()
  })

  it('renders multiple typing users separated by comma', () => {
    render(
      <ChatHeader
        conversation={groupConv}
        typingUserNames={['Lê Thị B', 'Trần C']}
      />
    )

    expect(
      screen.getByText('Lê Thị B, Trần C đang soạn tin nhắn...')
    ).toBeInTheDocument()
  })

  it('handles search and info button clicks', () => {
    const onSearchClick = vi.fn()
    const onInfoClick = vi.fn()

    render(
      <ChatHeader
        conversation={directConv}
        onSearchClick={onSearchClick}
        onInfoClick={onInfoClick}
      />
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Tìm kiếm trong cuộc trò chuyện' })
    )
    expect(onSearchClick).toHaveBeenCalledTimes(1)

    fireEvent.click(
      screen.getByRole('button', { name: 'Thông tin hội thoại' })
    )
    expect(onInfoClick).toHaveBeenCalledTimes(1)
  })

  it('triggers onInfoClick when clicking the avatar/title container', () => {
    const onInfoClick = vi.fn()

    render(
      <ChatHeader
        conversation={directConv}
        onInfoClick={onInfoClick}
      />
    )

    const titleContainer = screen.getByRole('button', { name: 'Xem thông tin cuộc trò chuyện' })
    fireEvent.click(titleContainer)
    expect(onInfoClick).toHaveBeenCalledTimes(1)
  })

  it('applies active styling when isInfoOpen is true', () => {
    render(
      <ChatHeader
        conversation={directConv}
        isInfoOpen={true}
      />
    )

    const infoBtn = screen.getByRole('button', { name: 'Thông tin hội thoại' })
    expect(infoBtn).toHaveClass('bg-brand/10')
  })
})
