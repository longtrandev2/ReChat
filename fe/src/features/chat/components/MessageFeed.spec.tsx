import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageFeed } from './MessageFeed'
import type { Message } from '../types/message.types'

describe('MessageFeed Component Tests', () => {
  const currentUserId = 'user-me'

  const mockMsg1: Message = {
    id: 'msg-1',
    content: 'Tin nhắn ngày hôm qua',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-25T14:00:00.000Z',
    updatedAt: '2026-10-25T14:00:00.000Z',
    sender: {
      id: 'user-friend',
      username: 'friend',
      displayName: 'Bạn Thân',
      avatarUrl: null,
    },
  }

  const mockMsg2: Message = {
    id: 'msg-2',
    content: 'Tin nhắn ngày hôm nay',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sender: {
      id: 'user-me',
      username: 'me',
      displayName: 'Tôi',
      avatarUrl: null,
    },
  }

  it('renders empty feed state when message list is empty', () => {
    render(<MessageFeed messages={[]} currentUserId={currentUserId} />)

    expect(screen.getByTestId('message-feed-empty')).toBeInTheDocument()
    expect(screen.getByText('Chưa có tin nhắn nào')).toBeInTheDocument()
  })

  it('renders messages and groups them with DateDivider on day transition', () => {
    render(
      <MessageFeed
        messages={[mockMsg1, mockMsg2]}
        currentUserId={currentUserId}
      />
    )

    expect(screen.getByText('Tin nhắn ngày hôm qua')).toBeInTheDocument()
    expect(screen.getByText('Tin nhắn ngày hôm nay')).toBeInTheDocument()
    // Should render date divider for today
    expect(screen.getByText('Hôm nay')).toBeInTheDocument()
  })

  it('shows loading spinner when isLoadingOlder is true', () => {
    render(
      <MessageFeed
        messages={[mockMsg1]}
        currentUserId={currentUserId}
        isLoadingOlder={true}
      />
    )

    expect(screen.getByTestId('feed-loading-older')).toBeInTheDocument()
  })

  it('triggers onLoadMore when user scrolls near the top', () => {
    const onLoadMore = vi.fn()

    render(
      <MessageFeed
        messages={[mockMsg1, mockMsg2]}
        currentUserId={currentUserId}
        hasMore={true}
        isLoadingOlder={false}
        onLoadMore={onLoadMore}
      />
    )

    const feed = screen.getByTestId('message-feed')
    // Simulate scroll to top (scrollTop = 10)
    Object.defineProperty(feed, 'scrollTop', { value: 10, writable: true })
    Object.defineProperty(feed, 'scrollHeight', { value: 1000, writable: true })
    Object.defineProperty(feed, 'clientHeight', { value: 500, writable: true })

    fireEvent.scroll(feed)
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('renders sender name in group chat for incoming messages', () => {
    render(
      <MessageFeed
        messages={[mockMsg1, mockMsg2]}
        currentUserId={currentUserId}
        isGroup={true}
      />
    )

    // mockMsg1 is from user-friend (incoming in group) -> should display 'Bạn Thân'
    expect(screen.getByText('Bạn Thân')).toBeInTheDocument()
    // mockMsg2 is from user-me (outgoing) -> should NOT display sender name above bubble
    expect(screen.queryByText('Tôi')).not.toBeInTheDocument()
  })

  it('renders Telegram typing 3-dots bubble when typingUserNames is provided', () => {
    render(
      <MessageFeed
        messages={[mockMsg1]}
        currentUserId={currentUserId}
        typingUserNames={['Bạn Thân']}
      />
    )

    expect(screen.getByTestId('feed-typing-bubble')).toBeInTheDocument()
  })

  it('correctly sets isRead to true when message matches lastReadMessageId', () => {
    render(
      <MessageFeed
        messages={[mockMsg2]}
        currentUserId={currentUserId}
        lastReadMessageId="msg-2"
      />
    )

    // mockMsg2 is outgoing and matches lastReadMessageId -> should be marked as read
    expect(screen.getByLabelText('Đã đọc')).toBeInTheDocument()
  })
})
