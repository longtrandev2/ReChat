import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { UserProfile } from '@/types/auth.types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/features/auth/services/auth.api', () => ({
  authApi: { getMe: vi.fn(), refresh: vi.fn(), logout: vi.fn() },
}))
vi.mock('../services/settings.api', () => ({
  settingsApi: { getSessions: vi.fn().mockResolvedValue([]) },
}))

import { authApi } from '@/features/auth/services/auth.api'
import { useAuthStore } from '@/stores/auth.store'
import { SettingsPage } from './SettingsPage'

const storeUser: UserProfile = {
  id: 'user-1',
  username: 'alex',
  email: 'alex@rechat.app',
  isEmailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
}

function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.search}</span>
}

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/settings"
          element={
            <>
              <SettingsPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  )

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: storeUser, token: 't', isAuthenticated: true, isInitializing: false })
    vi.mocked(authApi.getMe).mockResolvedValue(storeUser)
  })

  it('opens the profile tab by default', () => {
    renderAt('/settings')

    expect(screen.getByTestId('settings-tab-profile')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByTestId('profile-tab')).toBeInTheDocument()
  })

  it('switches tabs and mirrors the active tab in the URL query', async () => {
    const user = userEvent.setup()
    renderAt('/settings')

    await user.click(screen.getByTestId('settings-tab-security'))
    expect(screen.getByTestId('security-tab')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=security')

    await user.click(screen.getByTestId('settings-tab-sessions'))
    expect(await screen.findByTestId('sessions-tab')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=sessions')

    await user.click(screen.getByTestId('settings-tab-profile'))
    expect(screen.getByTestId('profile-tab')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('')
  })

  it('deep-links to a tab via ?tab= and falls back to profile for unknown values', () => {
    const { unmount } = renderAt('/settings?tab=security')
    expect(screen.getByTestId('security-tab')).toBeInTheDocument()
    unmount()

    renderAt('/settings?tab=hack')
    expect(screen.getByTestId('profile-tab')).toBeInTheDocument()
  })

  it('refreshes the full profile from GET /auth/me (e.g. twoFactorEnabled) into the store', async () => {
    vi.mocked(authApi.getMe).mockResolvedValue({ ...storeUser, twoFactorEnabled: true })
    renderAt('/settings?tab=security')

    await waitFor(() => expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true))
    expect(screen.getByTestId('2fa-status-badge')).toHaveTextContent('Đang kích hoạt')
  })
})
