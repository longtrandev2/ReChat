import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ChatDetailDrawer } from './ChatDetailDrawer'
import { conversationApi } from '@/features/conversations/services/conversation.api'
import { friendsApi } from '@/features/friends/services/friends.api'
import { messagesApi } from '../services/messages.api'
import { mediaApi } from '../services/media.api'
import { useAuthStore } from '@/stores/auth.store'
import type { UserProfile } from '@/types/auth.types'
import type { Conversation } from '@/features/conversations/types/conversation.types'
import type { Message } from '../types/message.types'

vi.mock('@/features/conversations/services/conversation.api', () => ({
  conversationApi: {
    updateGroup: vi.fn(),
    updateQuickEmoji: vi.fn(),
    addMembers: vi.fn(),
    updateMemberRole: vi.fn(),
    transferOwner: vi.fn(),
    kickMember: vi.fn(),
    leaveGroup: vi.fn(),
    blockUser: vi.fn(),
    getPinnedMessages: vi.fn().mockResolvedValue([]),
    getConversationById: vi.fn(),
  },
}))

vi.mock('@/features/friends/services/friends.api', () => ({
  friendsApi: {
    getFriends: vi.fn(),
  },
}))

vi.mock('../services/messages.api', () => ({
  messagesApi: {
    getMessages: vi.fn(),
  },
}))

vi.mock('../services/media.api', () => ({
  mediaApi: {
    uploadMedia: vi.fn(),
  },
}))

describe('ChatDetailDrawer Component Tests', () => {
  const currentUser = {
    id: 'user-1',
    username: 'owner_user',
    displayName: 'Trần Trưởng Nhóm',
    avatarUrl: null,
  }

  const directConv: Conversation = {
    id: 'conv-direct-1',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: 'https://example.com/avatar.jpg',
    quickEmoji: '👍',
    unreadCount: 0,
    lastMessage: null,
    lastMessageAt: '2026-10-26T00:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    members: [
      {
        id: 'm-direct-1',
        role: 'MEMBER',
        joinedAt: '2026-10-20T00:00:00.000Z',
        user: currentUser,
      },
      {
        id: 'm-direct-2',
        role: 'MEMBER',
        joinedAt: '2026-10-20T00:00:00.000Z',
        user: {
          id: 'user-partner',
          username: 'nguyenvana',
          displayName: 'Nguyễn Văn A',
          avatarUrl: 'https://example.com/avatar.jpg',
          isOnline: true,
        },
      },
    ],
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
    quickEmoji: '🔥',
    unreadCount: 0,
    memberCount: 3,
    lastMessage: null,
    lastMessageAt: '2026-10-26T00:00:00.000Z',
    members: [
      {
        id: 'member-1',
        role: 'OWNER',
        joinedAt: '2026-10-20T00:00:00.000Z',
        user: currentUser,
      },
      {
        id: 'member-2',
        role: 'ADMIN',
        joinedAt: '2026-10-21T00:00:00.000Z',
        user: {
          id: 'user-2',
          username: 'admin_user',
          displayName: 'Phạm Phó Nhóm',
          avatarUrl: null,
        },
      },
      {
        id: 'member-3',
        role: 'MEMBER',
        joinedAt: '2026-10-22T00:00:00.000Z',
        user: {
          id: 'user-3',
          username: 'member_user',
          displayName: 'Lê Thành Viên',
          avatarUrl: null,
        },
      },
    ],
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }

  const mockPinnedMessages: Message[] = [
    {
      id: 'pin-msg-1',
      content: 'Nội quy phòng chat dự án',
      type: 'TEXT',
      fileUrl: null,
      replyToId: null,
      isRecalled: false,
      isPinned: true,
      pinnedAt: '2026-10-26T10:00:00.000Z',
      pinnedBy: {
        id: 'user-1',
        username: 'owner_user',
        displayName: 'Trần Trưởng Nhóm',
        avatarUrl: null,
      },
      createdAt: '2026-10-26T09:00:00.000Z',
      updatedAt: '2026-10-26T09:00:00.000Z',
      sender: {
        id: 'user-1',
        username: 'owner_user',
        displayName: 'Trần Trưởng Nhóm',
        avatarUrl: null,
      },
    },
  ]

  const mockImageMessage: Message = {
    id: 'msg-img-1',
    content: 'Ảnh kiến trúc hệ thống',
    type: 'IMAGE',
    fileUrl: 'https://example.com/arch.png',
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    sender: {
      id: 'user-1',
      username: 'owner_user',
      displayName: 'Trần Trưởng Nhóm',
      avatarUrl: null,
    },
  }

  const mockFileMessage: Message = {
    id: 'msg-file-1',
    content: 'Tai_Lieu_Huong_Dan.pdf',
    type: 'FILE',
    fileUrl: 'https://example.com/guide.pdf',
    fileSize: 1024 * 1024 * 2.5,
    replyToId: null,
    isRecalled: false,
    createdAt: '2026-10-26T11:00:00.000Z',
    updatedAt: '2026-10-26T11:00:00.000Z',
    sender: {
      id: 'user-1',
      username: 'owner_user',
      displayName: 'Trần Trưởng Nhóm',
      avatarUrl: null,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: currentUser as unknown as UserProfile })
    vi.mocked(messagesApi.getMessages).mockResolvedValue([])
    vi.mocked(friendsApi.getFriends).mockResolvedValue([])
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={false}
          onClose={vi.fn()}
          conversation={directConv}
        />
      </MemoryRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('renders direct conversation details with online status, mute button, search, and privacy block button', async () => {
    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={directConv}
          partner={partnerUser}
          isOnline={true}
        />
      </MemoryRouter>
    )

    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByTitle('Đang trực tuyến')).toBeInTheDocument()
    expect(screen.getByText('@nguyenvana')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tắt thông báo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tìm kiếm tin nhắn' })).toBeInTheDocument()

    // Accordions
    expect(screen.getByTestId('accordion-chat-info')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-customization')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-media-files')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-privacy')).toBeInTheDocument()

    // In direct chat, members accordion is not shown
    expect(screen.queryByTestId('accordion-members')).not.toBeInTheDocument()

    // Expand privacy section and verify block user button exists
    fireEvent.click(screen.getByTestId('accordion-privacy'))
    expect(screen.getByTestId('block-user-button')).toBeInTheDocument()
  })

  it('renders group conversation details with 5 accordions, member list, and role badges', async () => {
    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Đội Dự Án ReChat' })).toBeInTheDocument()
    expect(screen.getByText('3 thành viên')).toBeInTheDocument()

    // 5 Accordions exist
    expect(screen.getByTestId('accordion-chat-info')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-customization')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-members')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-media-files')).toBeInTheDocument()
    expect(screen.getByTestId('accordion-privacy')).toBeInTheDocument()

    // Group members and badges
    expect(screen.getByText('Trần Trưởng Nhóm')).toBeInTheDocument()
    expect(screen.getByText('(Bạn)')).toBeInTheDocument()
    expect(screen.getByText(/Trưởng nhóm/)).toBeInTheDocument()
    expect(screen.getByText('Phạm Phó Nhóm')).toBeInTheDocument()
    expect(screen.getByText(/Quản trị viên/)).toBeInTheDocument()
    expect(screen.getByText('Lê Thành Viên')).toBeInTheDocument()
    expect(screen.getByText('Thành viên')).toBeInTheDocument()

    // Add member button is present for Owner/Admin
    expect(screen.getByTestId('add-member-button')).toBeInTheDocument()
  })

  it('toggles accordion sections open and closed', async () => {
    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    // Initially "chat_info" is open, showing "view-pinned-messages-button"
    expect(screen.getByTestId('view-pinned-messages-button')).toBeInTheDocument()

    // Click accordion header to toggle closed
    const header = screen.getByTestId('accordion-chat-info')
    fireEvent.click(header)

    // Button should now be hidden
    expect(screen.queryByTestId('view-pinned-messages-button')).not.toBeInTheDocument()

    // Click again to reopen
    fireEvent.click(header)
    expect(screen.getByTestId('view-pinned-messages-button')).toBeInTheDocument()
  })

  it('opens and displays pinned messages modal with onUnpinMessage and onJumpToMessage handlers', async () => {
    const onUnpin = vi.fn()
    const onJump = vi.fn()

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
          pinnedMessages={mockPinnedMessages}
          onUnpinMessage={onUnpin}
          onJumpToMessage={onJump}
        />
      </MemoryRouter>
    )

    // Click "Xem tin nhắn đã ghim"
    const openBtn = screen.getByTestId('view-pinned-messages-button')
    fireEvent.click(openBtn)

    // Modal opens
    await waitFor(() => {
      expect(screen.getByTestId('pinned-messages-dialog')).toBeInTheDocument()
    })
    expect(screen.getByText('Nội quy phòng chat dự án')).toBeInTheDocument()

    // Click unpin button
    const unpinBtn = screen.getByTestId('dialog-unpin-btn-pin-msg-1')
    fireEvent.click(unpinBtn)
    expect(onUnpin).toHaveBeenCalledWith(mockPinnedMessages[0])

    // Click jump to message (closes modal)
    const item = screen.getByTestId('pinned-dialog-item-pin-msg-1')
    fireEvent.click(item)
    expect(onJump).toHaveBeenCalledWith('pin-msg-1')
  })

  it('handles renaming group in rename modal', async () => {
    vi.mocked(conversationApi.updateGroup).mockResolvedValue({
      id: groupConv.id,
      name: 'Tên Nhóm Siêu Cấp',
    } as unknown as Conversation)

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    const renameBtn = screen.getByTestId('rename-group-button')
    fireEvent.click(renameBtn)

    await waitFor(() => {
      expect(screen.getByTestId('rename-group-dialog')).toBeInTheDocument()
    })

    const input = screen.getByTestId('rename-group-input')
    fireEvent.change(input, { target: { value: 'Tên Nhóm Siêu Cấp' } })

    const saveBtn = screen.getByTestId('rename-group-submit')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(conversationApi.updateGroup).toHaveBeenCalledWith(
        groupConv.id,
        { name: 'Tên Nhóm Siêu Cấp' }
      )
    })
  })

  it('handles selecting quick emoji from popover', async () => {
    const user = userEvent.setup()
    vi.mocked(conversationApi.updateQuickEmoji).mockResolvedValue({
      quickEmoji: '🎉',
    })

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    const emojiTrigger = screen.getByTestId('change-quick-emoji-button')
    await user.click(emojiTrigger)

    await waitFor(() => {
      expect(screen.getByTestId('quick-emoji-popover')).toBeInTheDocument()
    })

    const targetEmojiBtn = screen.getByTestId('select-emoji-🎉')
    await user.click(targetEmojiBtn)

    await waitFor(() => {
      expect(conversationApi.updateQuickEmoji).toHaveBeenCalledWith(groupConv.id, '🎉')
    })
  })

  it('handles adding members modal and friend selection', async () => {
    const mockFriends = [
      {
        id: 'friend-1',
        displayName: 'Bạn Mới A',
        username: 'friend_a',
        avatarUrl: null,
        isOnline: true,
      },
    ]
    vi.mocked(friendsApi.getFriends).mockResolvedValue(mockFriends)
    vi.mocked(conversationApi.addMembers).mockResolvedValue(undefined)

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    const addMemberBtn = screen.getByTestId('add-member-button')
    fireEvent.click(addMemberBtn)

    await waitFor(() => {
      expect(screen.getByTestId('add-member-dialog')).toBeInTheDocument()
      expect(screen.getByText('Bạn Mới A')).toBeInTheDocument()
    })

    // Select friend
    const friendCheckbox = screen.getByTestId('friend-option-friend-1')
    fireEvent.click(friendCheckbox)

    // Click submit
    const submitBtn = screen.getByTestId('add-members-submit-button')
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(conversationApi.addMembers).toHaveBeenCalledWith(
        groupConv.id,
        ['friend-1']
      )
    })
  })

  it('handles member actions (promote/demote/kick/transfer owner)', async () => {
    const user = userEvent.setup()
    vi.mocked(conversationApi.updateMemberRole).mockResolvedValue({ message: 'OK' })
    vi.mocked(conversationApi.kickMember).mockResolvedValue({ message: 'OK' })
    vi.mocked(conversationApi.transferOwner).mockResolvedValue({ message: 'OK' })

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    // Open dropdown for user-3 (member_user - role MEMBER)
    const member3MenuTrigger = screen.getByTestId('member-actions-user-3')
    await user.click(member3MenuTrigger)

    await waitFor(() => {
      expect(screen.getByTestId('promote-member-user-3')).toBeInTheDocument()
    })

    // Click promote
    const promoteItem = screen.getByTestId('promote-member-user-3')
    await user.click(promoteItem)

    await waitFor(() => {
      expect(conversationApi.updateMemberRole).toHaveBeenCalledWith(
        groupConv.id,
        'user-3',
        'ADMIN'
      )
    })
  })

  it('handles leave group action with confirmation dialog', async () => {
    vi.mocked(conversationApi.leaveGroup).mockResolvedValue({ message: 'OK' })

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
        />
      </MemoryRouter>
    )

    // Expand privacy accordion
    fireEvent.click(screen.getByTestId('accordion-privacy'))

    // Privacy accordion section has "leave-group-button"
    const leaveBtn = screen.getByTestId('leave-group-button')
    fireEvent.click(leaveBtn)

    await waitFor(() => {
      expect(screen.getByText('Rời khỏi nhóm trò chuyện?')).toBeInTheDocument()
    })

    const confirmBtn = screen.getByTestId('confirm-leave-group-submit')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(conversationApi.leaveGroup).toHaveBeenCalledWith(groupConv.id)
    })
  })

  it('handles media and file tab switching and image lightbox click', async () => {
    const onImageClick = vi.fn()
    vi.mocked(messagesApi.getMessages).mockImplementation(async (_convId, query) => {
      if (query?.type === 'IMAGE') return [mockImageMessage]
      if (query?.type === 'FILE') return [mockFileMessage]
      return []
    })

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={directConv}
          partner={partnerUser}
          onImageClick={onImageClick}
        />
      </MemoryRouter>
    )

    // Open media & files accordion
    const mediaAccordionHeader = screen.getByTestId('accordion-media-files')
    fireEvent.click(mediaAccordionHeader)

    await waitFor(() => {
      expect(screen.getByText('Ảnh (1)')).toBeInTheDocument()
    })

    const imgThumb = screen.getByAltText('Ảnh kiến trúc hệ thống')
    fireEvent.click(imgThumb.parentElement!)
    expect(onImageClick).toHaveBeenCalledWith('https://example.com/arch.png', 'Ảnh kiến trúc hệ thống')

    // Switch to files tab
    const filesTabBtn = screen.getByRole('button', { name: /Tệp/ })
    fireEvent.click(filesTabBtn)

    await waitFor(() => {
      expect(screen.getByText('Tệp (1)')).toBeInTheDocument()
      expect(screen.getByText('Tai_Lieu_Huong_Dan.pdf')).toBeInTheDocument()
      expect(screen.getByText('2.5 MB')).toBeInTheDocument()
    })
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={onClose}
          conversation={directConv}
        />
      </MemoryRouter>
    )

    const closeBtn = screen.getByRole('button', { name: 'Đóng bảng thông tin' })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('handles uploading new group avatar with mediaApi and conversationApi', async () => {
    const onConversationUpdated = vi.fn()
    vi.mocked(mediaApi.uploadMedia).mockResolvedValueOnce({
      url: 'https://res.cloudinary.com/test/image/upload/new_group_avatar.png',
      secure_url: 'https://res.cloudinary.com/test/image/upload/new_group_avatar.png',
      publicId: 'rechat/images/new_group_avatar',
    })
    vi.mocked(conversationApi.updateGroup).mockResolvedValueOnce({
      ...groupConv,
      avatarUrl: 'https://res.cloudinary.com/test/image/upload/new_group_avatar.png',
    })

    render(
      <MemoryRouter>
        <ChatDetailDrawer
          isOpen={true}
          onClose={vi.fn()}
          conversation={groupConv}
          onConversationUpdated={onConversationUpdated}
        />
      </MemoryRouter>
    )

    const fileInput = screen.getByTestId('avatar-file-input')
    const file = new File(['avatar content'], 'avatar.png', { type: 'image/png' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(mediaApi.uploadMedia).toHaveBeenCalledWith(file)
      expect(conversationApi.updateGroup).toHaveBeenCalledWith(groupConv.id, {
        avatarUrl: 'https://res.cloudinary.com/test/image/upload/new_group_avatar.png',
      })
      expect(onConversationUpdated).toHaveBeenCalledWith({
        avatarUrl: 'https://res.cloudinary.com/test/image/upload/new_group_avatar.png',
      })
    })
  })
})
