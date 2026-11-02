import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth-broadcast', () => ({
  postAuthBroadcast: vi.fn(),
  subscribeToAuthBroadcast: vi.fn(() => () => {}),
}))

import { postAuthBroadcast } from '@/lib/auth-broadcast'
import { useAuthStore } from '@/stores/auth.store'
import { patchAuthUser } from './patch-auth-user'
import type { UserProfile } from '@/types/auth.types'

const mockUser: UserProfile = {
  id: 'user-1',
  username: 'alex_tr',
  email: 'alex@rechat.app',
  displayName: 'Alex Tran',
  isEmailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
}

describe('patchAuthUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: mockUser, token: 't', isAuthenticated: true })
  })

  it('merges the patch into the store and broadcasts AUTH_USER_UPDATED to other tabs', () => {
    patchAuthUser({ displayName: 'Alex Mới' })

    expect(useAuthStore.getState().user?.displayName).toBe('Alex Mới')
    expect(postAuthBroadcast).toHaveBeenCalledWith({
      type: 'AUTH_USER_UPDATED',
      payload: { user: { ...mockUser, displayName: 'Alex Mới' } },
    })
  })

  it('does nothing (no broadcast) when there is no logged-in user', () => {
    useAuthStore.setState({ user: null, isAuthenticated: false })

    patchAuthUser({ displayName: 'X' })

    expect(useAuthStore.getState().user).toBeNull()
    expect(postAuthBroadcast).not.toHaveBeenCalled()
  })
})
