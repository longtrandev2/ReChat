import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatHeader } from './ChatHeader'
import type { Conversation } from '@/features/conversations/types/conversation.types'

describe('ChatHeader Component Tests', () => {
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
  }

  const groupConv: Conversation = {
    id: 'conv-2',
    type: 'GROUP',
    name: 'Nhóm Dự Án ReChat',
    avatarUrl: null,
    unreadCount: 0,
    lastMessage: null,
    lastMessageAt: '2026-10-26T00:00:00.000Z',
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

  it('handles search and info button clicks', async () => {
    const user = userEvent.setup()
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

    // 3-dot menu -> "Xem thông tin"
    await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
    await user.click(await screen.findByRole('menuitem', { name: /Xem thông tin/ }))
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

    const infoBtn = screen.getByRole('button', { name: 'Tùy chọn hội thoại' })
    expect(infoBtn).toHaveClass('bg-brand/10')
  })

  it('handles mute button toggle and renders BellOff when isMuted is true', () => {
    const onToggleMute = vi.fn()

    const { rerender } = render(
      <ChatHeader
        conversation={directConv}
        isMuted={false}
        onToggleMute={onToggleMute}
      />
    )

    const muteBtn = screen.getByTestId('chat-header-mute-btn')
    expect(muteBtn).toHaveAttribute('aria-label', 'Tắt thông báo')

    fireEvent.click(muteBtn)
    expect(onToggleMute).toHaveBeenCalledTimes(1)

    rerender(
      <ChatHeader
        conversation={directConv}
        isMuted={true}
        onToggleMute={onToggleMute}
      />
    )

    const mutedBtn = screen.getByTestId('chat-header-mute-btn')
    expect(mutedBtn).toHaveAttribute('aria-label', 'Bật thông báo')
    expect(mutedBtn).toHaveClass('text-coral')
  })

  it('applies active styling to search button when isSearchOpen is true', () => {
    render(
      <ChatHeader
        conversation={directConv}
        isSearchOpen={true}
      />
    )

    const searchBtn = screen.getByTestId('chat-header-search-btn')
    expect(searchBtn).toHaveClass('bg-brand/10')
  })
  describe('3-dot menu (FR-48)', () => {
    it('shows pin / clear / block items for DIRECT and fires handlers', async () => {
      const user = userEvent.setup()
      const onTogglePin = vi.fn()
      const onClearHistory = vi.fn()
      const onBlock = vi.fn()

      render(
        <ChatHeader
          conversation={directConv}
          onTogglePin={onTogglePin}
          onClearHistory={onClearHistory}
          onBlock={onBlock}
        />
      )

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Ghim cuộc trò chuyện' }))
      expect(onTogglePin).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Xóa đoạn chat' }))
      expect(onClearHistory).toHaveBeenCalledTimes(1)

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Chặn người dùng' }))
      expect(onBlock).toHaveBeenCalledTimes(1)
    })

    it('shows "Bỏ ghim" when pinned and "Bỏ chặn" when blocked by me', async () => {
      const user = userEvent.setup()
      render(
        <ChatHeader
          conversation={directConv}
          isPinned
          blockStatus="BLOCKED_BY_ME"
          onTogglePin={vi.fn()}
          onBlock={vi.fn()}
          onUnblock={vi.fn()}
        />
      )

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      expect(await screen.findByRole('menuitem', { name: 'Bỏ ghim' })).toBeInTheDocument()
      expect(screen.getByRole('menuitem', { name: 'Bỏ chặn' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Chặn người dùng' })).not.toBeInTheDocument()
    })

    it('hides "Chặn người dùng" and "Bỏ chặn" when the user is the blocked one (BR-38)', async () => {
      const user = userEvent.setup()
      render(
        <ChatHeader conversation={directConv} blockStatus="BLOCKED_ME" onBlock={vi.fn()} onUnblock={vi.fn()} onClearHistory={vi.fn()} />
      )

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      expect(await screen.findByRole('menuitem', { name: 'Xóa đoạn chat' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Chặn người dùng' })).not.toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Bỏ chặn' })).not.toBeInTheDocument()
    })

    it('hides block items for GROUP conversations', async () => {
      const user = userEvent.setup()
      render(<ChatHeader conversation={groupConv} onBlock={vi.fn()} onClearHistory={vi.fn()} />)

      await user.click(screen.getByRole('button', { name: 'Tùy chọn hội thoại' }))
      expect(await screen.findByRole('menuitem', { name: 'Xóa đoạn chat' })).toBeInTheDocument()
      expect(screen.queryByRole('menuitem', { name: 'Chặn người dùng' })).not.toBeInTheDocument()
    })

    it('hides online status and dot when blocked', () => {
      render(<ChatHeader conversation={directConv} isOnline blockStatus="BLOCKED_ME" />)
      expect(screen.queryByText('Đang trực tuyến')).not.toBeInTheDocument()
      expect(screen.getByText('Ngoại tuyến')).toBeInTheDocument()
    })
  })
})
