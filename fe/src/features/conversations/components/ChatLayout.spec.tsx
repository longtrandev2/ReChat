import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ChatLayout } from './ChatLayout'
import { useConversationStore } from '../stores/conversation.store'
import type { Conversation } from '../types/conversation.types'

// Mock useSocket
vi.mock('@/hooks/useSocket', () => ({
  useSocket: () => ({
    isUserOnline: vi.fn(() => false),
    isConnected: true,
  }),
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname}</div>
}

describe('ChatLayout Component Tests', () => {
  const user = userEvent.setup()

  const mockConv: Conversation = {
    id: 'conv-test-101',
    type: 'DIRECT',
    name: 'Nguyễn Văn A',
    avatarUrl: null,
    unreadCount: 0,
    lastMessage: null,
    lastMessageAt: '2026-10-26T10:00:00.000Z',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
  }

  it('renders sidebar and nested outlet canvas, and navigates when selecting conversation', async () => {
    useConversationStore.setState({
      conversations: [mockConv],
      activeConversationId: null,
      searchQuery: '',
      filterTab: 'all',
      isLoading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/chat']}>
        <Routes>
          <Route path="/chat" element={<ChatLayout />}>
            <Route index element={<div>Welcome Canvas Child</div>} />
            <Route path=":conversationId" element={<div>Active Chat Child</div>} />
          </Route>
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    )

    // Sidebar is present
    expect(screen.getByRole('heading', { name: 'Đoạn chat' })).toBeInTheDocument()
    // Nested outlet index is present
    expect(screen.getByText('Welcome Canvas Child')).toBeInTheDocument()

    // Click conversation item
    const item = screen.getByText('Nguyễn Văn A')
    await user.click(item)

    // Navigates to /chat/conv-test-101
    expect(screen.getByTestId('location-display')).toHaveTextContent('/chat/conv-test-101')
    expect(screen.getByText('Active Chat Child')).toBeInTheDocument()
  })
})
