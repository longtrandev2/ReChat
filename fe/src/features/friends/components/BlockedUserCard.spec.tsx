import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockedUserCard } from './BlockedUserCard'
import type { BlockedUser } from '../types/friends.types'

describe('BlockedUserCard Component Tests', () => {
  const mockUser: BlockedUser = {
    id: 'blocked-user-1',
    username: 'blockeduser',
    displayName: 'Blocked Person',
    avatarUrl: null,
    blockedAt: '2026-10-15T10:00:00.000Z',
  }

  it('renders blocked user details and "Bỏ chặn" button', () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(<BlockedUserCard user={mockUser} onUnblock={onUnblock} />)

    expect(screen.getByText('Blocked Person')).toBeInTheDocument()
    expect(screen.getByText('@blockeduser')).toBeInTheDocument()
    expect(screen.getByText(/Đã chặn từ/)).toBeInTheDocument()

    const unblockBtn = screen.getByTestId('unblock-btn-blocked-user-1')
    expect(unblockBtn).toBeInTheDocument()
    expect(unblockBtn).toHaveTextContent('Bỏ chặn')
  })

  it('calls onUnblock when clicking the button', async () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(<BlockedUserCard user={mockUser} onUnblock={onUnblock} />)

    const unblockBtn = screen.getByTestId('unblock-btn-blocked-user-1')
    fireEvent.click(unblockBtn)

    expect(onUnblock).toHaveBeenCalledWith('blocked-user-1')
  })
})
