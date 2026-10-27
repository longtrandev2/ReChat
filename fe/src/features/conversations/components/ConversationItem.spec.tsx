import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationItem } from './ConversationItem'
import type { Conversation } from '../types/conversation.types'

describe('ConversationItem Component Tests', () => {
  const user = userEvent.setup()

  const mockDirectConv: Conversation = {
    id: 'conv-direct-1',
    type: 'DIRECT',
    name: 'Alex Tran',
    avatarUrl: null,
    unreadCount: 3,
    lastMessage: {
      id: 'msg-1',
      content: 'Chào buổi sáng bạn!',
      type: 'TEXT',
      createdAt: '2026-10-26T10:15:00.000Z',
    },
    lastMessageAt: '2026-10-26T10:15:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T10:15:00.000Z',
  }

  const mockGroupConv: Conversation = {
    id: 'conv-group-1',
    type: 'GROUP',
    name: 'Nhóm Lập Trình ReChat',
    avatarUrl: null,
    unreadCount: 0,
    lastMessage: {
      id: 'msg-2',
      content: 'Đã gửi file spec',
      type: 'RAW',
      createdAt: '2026-10-25T14:00:00.000Z',
    },
    lastMessageAt: '2026-10-25T14:00:00.000Z',
    createdAt: '2026-10-21T00:00:00.000Z',
    updatedAt: '2026-10-25T14:00:00.000Z',
  }

  it('renders direct conversation with initials, name, and unread badge', () => {
    render(<ConversationItem conversation={mockDirectConv} isOnline={true} />)

    // Name & Initials
    expect(screen.getByText('Alex Tran')).toBeInTheDocument()
    expect(screen.getByText('AT')).toBeInTheDocument()

    // Last message preview
    expect(screen.getByText('Chào buổi sáng bạn!')).toBeInTheDocument()

    // Unread counter badge
    const badge = screen.getByTestId('unread-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('3')

    // Online presence dot
    expect(screen.getByTitle('Đang trực tuyến')).toBeInTheDocument()
  })

  it('renders group conversation and special preview for attachments', () => {
    render(<ConversationItem conversation={mockGroupConv} />)

    expect(screen.getByText('Nhóm Lập Trình ReChat')).toBeInTheDocument()
    expect(screen.getByText('[Tệp đính kèm]')).toBeInTheDocument()
    expect(screen.getByText('Đã gửi file spec')).toBeInTheDocument()
    expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument()
  })

  it('renders special preview for FILE type attachment with file name', () => {
    const fileConv: Conversation = {
      ...mockDirectConv,
      lastMessage: {
        id: 'msg-file',
        content: 'BaoCaoTienDo.xlsx',
        type: 'FILE',
        createdAt: '2026-10-26T12:00:00.000Z',
      },
    }

    render(<ConversationItem conversation={fileConv} />)
    expect(screen.getByText('[Tệp đính kèm]')).toBeInTheDocument()
    expect(screen.getByText('BaoCaoTienDo.xlsx')).toBeInTheDocument()
  })

  it('renders special snippet for recalled message', () => {
    const recalledConv: Conversation = {
      ...mockDirectConv,
      lastMessage: {
        id: 'msg-3',
        content: '[Tin nhắn đã bị thu hồi]',
        type: 'TEXT',
        createdAt: '2026-10-26T10:30:00.000Z',
      },
    }

    render(<ConversationItem conversation={recalledConv} />)
    expect(screen.getByText('[Tin nhắn đã thu hồi]')).toBeInTheDocument()
  })

  it('triggers onClick handler when clicking row', async () => {
    const handleClick = vi.fn()
    render(<ConversationItem conversation={mockDirectConv} onClick={handleClick} />)

    const row = screen.getByRole('option')
    await user.click(row)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
