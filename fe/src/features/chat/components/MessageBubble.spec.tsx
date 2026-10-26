import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from './MessageBubble'
import type { Message } from '../types/message.types'

describe('MessageBubble Component Tests', () => {
  const baseMessage: Message = {
    id: 'msg-1',
    content: 'Xin chào bạn nhé!',
    type: 'TEXT',
    fileUrl: null,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T10:30:00.000Z',
    updatedAt: '2026-10-26T10:30:00.000Z',
    sender: {
      id: 'user-1',
      username: 'user1',
      displayName: 'Nguyễn Văn A',
      avatarUrl: null,
    },
  }

  it('renders outgoing text message with right alignment and read status', () => {
    render(<MessageBubble message={baseMessage} isOutgoing={true} isRead={true} />)

    expect(screen.getByText('Xin chào bạn nhé!')).toBeInTheDocument()
    expect(screen.getByLabelText('Đã đọc')).toBeInTheDocument()
    const container = screen.getByTestId('message-bubble-msg-1')
    expect(container).toHaveClass('justify-end')
  })

  it('renders outgoing unread message with single tick', () => {
    render(<MessageBubble message={baseMessage} isOutgoing={true} isRead={false} />)

    expect(screen.getByLabelText('Đã gửi')).toBeInTheDocument()
  })

  it('renders incoming text message with left alignment and sender avatar', () => {
    render(<MessageBubble message={baseMessage} isOutgoing={false} showAvatar={true} />)

    expect(screen.getByText('Xin chào bạn nhé!')).toBeInTheDocument()
    expect(screen.queryByLabelText('Đã đọc')).not.toBeInTheDocument()
    // Check avatar fallback initials 'NV'
    expect(screen.getByText('NV')).toBeInTheDocument()
    const container = screen.getByTestId('message-bubble-msg-1')
    expect(container).toHaveClass('justify-start')
  })

  it('renders sender name for incoming message in group chat', () => {
    render(
      <MessageBubble
        message={baseMessage}
        isOutgoing={false}
        isGroup={true}
        showSenderName={true}
      />
    )

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
  })

  it('renders recalled message with placeholder text', () => {
    const recalledMsg: Message = {
      ...baseMessage,
      isRecalled: true,
      content: '[Tin nhắn đã bị thu hồi]',
    }

    render(<MessageBubble message={recalledMsg} isOutgoing={false} />)

    expect(screen.getByText('[Tin nhắn đã bị thu hồi]')).toBeInTheDocument()
    expect(screen.getByText('[Tin nhắn đã bị thu hồi]')).toHaveClass('italic')
  })

  it('renders image attachment when message type is IMAGE', () => {
    const imageMsg: Message = {
      ...baseMessage,
      type: 'IMAGE',
      fileUrl: 'https://example.com/photo.jpg',
      content: 'Ảnh chụp chuyến đi',
    }

    render(<MessageBubble message={imageMsg} isOutgoing={true} />)

    const img = screen.getByRole('img', { name: 'Hình ảnh đính kèm' })
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg')
    expect(screen.getByText('Ảnh chụp chuyến đi')).toBeInTheDocument()
  })

  it('renders reaction pills and triggers onReact when clicked', async () => {
    const handleReact = vi.fn()
    const reactedMsg: Message = {
      ...baseMessage,
      reactions: [
        {
          emoji: '❤️',
          count: 3,
          users: [{ id: 'user-2', displayName: 'User Hai' }],
          hasReacted: true,
        },
      ],
    }

    render(<MessageBubble message={reactedMsg} isOutgoing={false} onReact={handleReact} />)

    expect(screen.getByText('❤️')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    const pill = screen.getByTitle('User Hai')
    pill.click()
    expect(handleReact).toHaveBeenCalledWith(reactedMsg, '❤️')
  })

  it('renders (đã sửa) indicator when message isEdited is true', () => {
    const editedMsg: Message = {
      ...baseMessage,
      isEdited: true,
      content: 'Nội dung sau khi sửa',
    }

    render(<MessageBubble message={editedMsg} isOutgoing={true} />)

    expect(screen.getByText('(đã sửa)')).toBeInTheDocument()
    expect(screen.getByText('Nội dung sau khi sửa')).toBeInTheDocument()
  })
})
