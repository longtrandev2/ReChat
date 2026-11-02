import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CreateGroupModal } from './CreateGroupModal'
import { conversationApi } from '../services/conversation.api'
import { friendsApi } from '@/features/friends/services/friends.api'
import { userApi } from '@/features/users/services/user.api'
import { useConversationStore } from '../stores/conversation.store'
import { useAuthStore } from '@/stores/auth.store'
import type { Conversation } from '../types/conversation.types'

import type { UserProfile } from '@/types/auth.types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../services/conversation.api', () => ({
  conversationApi: {
    createGroup: vi.fn(),
  },
}))

vi.mock('@/features/friends/services/friends.api', () => ({
  friendsApi: {
    getFriends: vi.fn(),
  },
}))

vi.mock('@/features/users/services/user.api', () => ({
  userApi: {
    searchUsers: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('CreateGroupModal Component Tests', () => {
  const user = userEvent.setup()

  const mockCurrentUser: UserProfile = {
    id: 'user-current-id',
    username: 'currentuser',
    displayName: 'Current User',
    email: 'current@example.com',
    isEmailVerified: true,
    twoFactorEnabled: false,
    createdAt: '2026-10-14T10:00:00.000Z',
  }

  const mockFriends = [
    {
      id: 'friend-1',
      username: 'bob123',
      displayName: 'Bob Trần',
      avatarUrl: null,
    },
    {
      id: 'friend-2',
      username: 'alice456',
      displayName: 'Alice Nguyễn',
      avatarUrl: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: mockCurrentUser, isAuthenticated: true })
    vi.mocked(friendsApi.getFriends).mockResolvedValue(mockFriends)
    vi.mocked(userApi.searchUsers).mockResolvedValue([])
  })

  it('renders modal when open and fetches friends list', async () => {
    render(
      <MemoryRouter>
        <CreateGroupModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    )

    expect(screen.getByText('Tạo nhóm chat mới')).toBeInTheDocument()
    expect(screen.getByTestId('group-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('member-search-input')).toBeInTheDocument()

    // Friends list should be fetched and rendered
    await waitFor(() => {
      expect(screen.getByText('Bob Trần')).toBeInTheDocument()
      expect(screen.getByText('Alice Nguyễn')).toBeInTheDocument()
    })
  })

  it('keeps submit button disabled until valid group name and at least 1 member selected', async () => {
    render(
      <MemoryRouter>
        <CreateGroupModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    )

    const submitBtn = screen.getByTestId('submit-create-group')
    expect(submitBtn).toBeDisabled()

    // Type group name
    await user.type(screen.getByTestId('group-name-input'), 'Dự án ReChat')
    expect(submitBtn).toBeDisabled()

    // Wait for friends and select one
    await waitFor(() => {
      expect(screen.getByTestId('candidate-user-friend-1')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('candidate-user-friend-1'))

    // Now submit button should be enabled
    expect(submitBtn).toBeEnabled()
  })

  it('toggles member selection and displays selected member chips', async () => {
    render(
      <MemoryRouter>
        <CreateGroupModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByTestId('candidate-user-friend-1')).toBeInTheDocument()
    })

    // Click candidate
    await user.click(screen.getByTestId('candidate-user-friend-1'))
    expect(screen.getByTestId('selected-chip-friend-1')).toBeInTheDocument()

    // Click remove on chip
    const removeBtn = screen.getByLabelText('Gỡ Bob Trần')
    await user.click(removeBtn)

    expect(screen.queryByTestId('selected-chip-friend-1')).not.toBeInTheDocument()
  })

  it('submits form, calls createGroup API, adds to store, and navigates', async () => {
    const mockCreatedGroup: Conversation = {
      id: 'group-conv-new-1',
      type: 'GROUP',
      name: 'Nhóm Dev FE',
      avatarUrl: null,
      unreadCount: 0,
      lastMessage: null,
      lastMessageAt: '2026-11-02T10:00:00.000Z',
      createdAt: '2026-11-02T10:00:00.000Z',
      updatedAt: '2026-11-02T10:00:00.000Z',
    }
    vi.mocked(conversationApi.createGroup).mockResolvedValue(mockCreatedGroup)

    const handleClose = vi.fn()

    render(
      <MemoryRouter>
        <CreateGroupModal isOpen={true} onClose={handleClose} />
      </MemoryRouter>
    )

    await user.type(screen.getByTestId('group-name-input'), 'Nhóm Dev FE')

    await waitFor(() => {
      expect(screen.getByTestId('candidate-user-friend-1')).toBeInTheDocument()
    })
    await user.click(screen.getByTestId('candidate-user-friend-1'))

    await user.click(screen.getByTestId('submit-create-group'))

    await waitFor(() => {
      expect(conversationApi.createGroup).toHaveBeenCalledWith({
        name: 'Nhóm Dev FE',
        memberIds: ['friend-1'],
      })
    })

    expect(handleClose).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/chat/group-conv-new-1')
    expect(useConversationStore.getState().conversations).toContainEqual(mockCreatedGroup)
  })

  it('searches for users across the system when typing in search input', async () => {
    vi.mocked(userApi.searchUsers).mockResolvedValue([
      {
        id: 'searched-user-99',
        username: 'david_dev',
        displayName: 'David Dev',
        avatarUrl: null,
      },
    ])

    render(
      <MemoryRouter>
        <CreateGroupModal isOpen={true} onClose={vi.fn()} />
      </MemoryRouter>
    )

    await user.type(screen.getByTestId('member-search-input'), 'david')

    await waitFor(() => {
      expect(userApi.searchUsers).toHaveBeenCalledWith('david')
    })

    await waitFor(() => {
      expect(screen.getByText('David Dev')).toBeInTheDocument()
    })
  })
})
