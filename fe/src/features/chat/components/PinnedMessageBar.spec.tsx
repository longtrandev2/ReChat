import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PinnedMessageBar } from './PinnedMessageBar'
import type { Message } from '../types/message.types'

describe('PinnedMessageBar Component Tests', () => {
  const mockPinnedMsg1: Message = {
    id: 'pin-msg-1',
    content: 'Nội dung tin nhắn ghim số 1',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    isPinned: true,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    sender: {
      id: 'sender-1',
      username: 'user1',
      displayName: 'Nguyễn Văn A',
      avatarUrl: null,
    },
  }

  const mockPinnedMsg2: Message = {
    id: 'pin-msg-2',
    content: 'Tệp hợp đồng dự án',
    type: 'FILE',
    fileUrl: 'https://example.com/contract.pdf',
    replyToId: null,
    isRecalled: false,
    isPinned: true,
    createdAt: '2026-10-26T11:00:00.000Z',
    updatedAt: '2026-10-26T11:00:00.000Z',
    sender: {
      id: 'sender-2',
      username: 'user2',
      displayName: 'Trần Thị B',
      avatarUrl: null,
    },
  }

  it('returns null when pinnedMessages is empty', () => {
    const { container } = render(
      <PinnedMessageBar
        pinnedMessages={[]}
        onJumpToMessage={vi.fn()}
        onUnpin={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders single pinned text message correctly', () => {
    const handleJump = vi.fn()
    const handleUnpin = vi.fn()

    render(
      <PinnedMessageBar
        pinnedMessages={[mockPinnedMsg1]}
        onJumpToMessage={handleJump}
        onUnpin={handleUnpin}
      />
    )

    expect(screen.getByTestId('pinned-message-bar')).toBeInTheDocument()
    expect(screen.getByText(/tin nhắn đã ghim/i)).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A:')).toBeInTheDocument()
    expect(screen.getByText('Nội dung tin nhắn ghim số 1')).toBeInTheDocument()
    expect(screen.queryByTestId('pinned-count-badge')).not.toBeInTheDocument()
  })

  it('renders multi-pin count badge and open list button when more than 1 message is pinned', () => {
    const handleOpenList = vi.fn()

    render(
      <PinnedMessageBar
        pinnedMessages={[mockPinnedMsg1, mockPinnedMsg2]}
        onJumpToMessage={vi.fn()}
        onUnpin={vi.fn()}
        onOpenPinnedList={handleOpenList}
      />
    )

    const badge = screen.getByTestId('pinned-count-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('2 tin')

    const listBtn = screen.getByTestId('open-pinned-list-button')
    expect(listBtn).toBeInTheDocument()

    fireEvent.click(listBtn)
    expect(handleOpenList).toHaveBeenCalledTimes(1)
  })

  it('calls onJumpToMessage when clicking the message content area', () => {
    const handleJump = vi.fn()

    render(
      <PinnedMessageBar
        pinnedMessages={[mockPinnedMsg1]}
        onJumpToMessage={handleJump}
        onUnpin={vi.fn()}
      />
    )

    const jumpButton = screen.getByTestId('pinned-bar-jump-button')
    fireEvent.click(jumpButton)

    expect(handleJump).toHaveBeenCalledTimes(1)
    expect(handleJump).toHaveBeenCalledWith('pin-msg-1')
  })

  it('calls onUnpin when clicking unpin button', () => {
    const handleUnpin = vi.fn()

    render(
      <PinnedMessageBar
        pinnedMessages={[mockPinnedMsg1]}
        onJumpToMessage={vi.fn()}
        onUnpin={handleUnpin}
      />
    )

    const unpinButton = screen.getByTestId('unpin-current-button')
    fireEvent.click(unpinButton)

    expect(handleUnpin).toHaveBeenCalledTimes(1)
    expect(handleUnpin).toHaveBeenCalledWith(mockPinnedMsg1)
  })

  it('formats snippet for image and file message types', () => {
    const imagePin: Message = {
      ...mockPinnedMsg1,
      id: 'img-pin',
      type: 'IMAGE',
      content: 'Ảnh sự kiện',
    }

    render(
      <PinnedMessageBar
        pinnedMessages={[imagePin]}
        onJumpToMessage={vi.fn()}
        onUnpin={vi.fn()}
      />
    )

    expect(screen.getByText('[Hình ảnh] Ảnh sự kiện')).toBeInTheDocument()
  })
})
