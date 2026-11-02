import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockedUsersTab } from './BlockedUsersTab'
import type { BlockedUser } from '../types/friends.types'

describe('BlockedUsersTab Component Tests', () => {
  const mockBlockedUsers: BlockedUser[] = [
    {
      id: 'b-1',
      username: 'alice',
      displayName: 'Alice Smith',
      avatarUrl: null,
      blockedAt: '2026-10-10T08:00:00.000Z',
    },
    {
      id: 'b-2',
      username: 'bob',
      displayName: 'Bob Jones',
      avatarUrl: null,
      blockedAt: '2026-10-12T09:00:00.000Z',
    },
  ]

  it('renders empty state when blockedUsers list is empty', () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(
      <BlockedUsersTab
        blockedUsers={[]}
        isLoading={false}
        onUnblock={onUnblock}
      />
    )

    expect(screen.getByTestId('blocked-users-empty')).toBeInTheDocument()
    expect(screen.getByText('Không có người dùng nào bị chặn')).toBeInTheDocument()
  })

  it('renders skeleton loading when isLoading is true and list is empty', () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(
      <BlockedUsersTab
        blockedUsers={[]}
        isLoading={true}
        onUnblock={onUnblock}
      />
    )

    expect(screen.getByTestId('blocked-users-skeleton')).toBeInTheDocument()
  })

  it('renders list of blocked users properly', () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(
      <BlockedUsersTab
        blockedUsers={mockBlockedUsers}
        isLoading={false}
        onUnblock={onUnblock}
      />
    )

    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Jones')).toBeInTheDocument()
    expect(screen.getByText('Danh sách chặn (2)')).toBeInTheDocument()
  })

  it('filters blocked users by search input', () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(
      <BlockedUsersTab
        blockedUsers={mockBlockedUsers}
        isLoading={false}
        onUnblock={onUnblock}
      />
    )

    const searchInput = screen.getByTestId('blocked-users-search-input')
    fireEvent.change(searchInput, { target: { value: 'Alice' } })

    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
  })

  it('shows no filter match message when search yields no results', () => {
    const onUnblock = vi.fn().mockResolvedValue(undefined)

    render(
      <BlockedUsersTab
        blockedUsers={mockBlockedUsers}
        isLoading={false}
        onUnblock={onUnblock}
      />
    )

    const searchInput = screen.getByTestId('blocked-users-search-input')
    fireEvent.change(searchInput, { target: { value: 'NonExistent' } })

    expect(screen.getByTestId('blocked-users-no-filter-match')).toBeInTheDocument()
  })
})
