import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { NavigationRail } from './NavigationRail'
import { useAuthStore } from '@/stores/auth.store'
import { authApi } from '@/features/auth/services/auth.api'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

// Mock authApi
vi.mock('@/features/auth/services/auth.api', () => ({
  authApi: {
    logout: vi.fn(),
  },
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname}</div>
}

function renderNavigationRail(initialRoute = '/chat') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <div className="flex h-screen">
        <NavigationRail />
        <Routes>
          <Route path="/" element={<div>Default Root</div>} />
          <Route path="/chat" element={<div>Chat View</div>} />
          <Route path="/friends" element={<div>Friends View</div>} />
          <Route path="/settings" element={<div>Settings View</div>} />
          <Route path="/login" element={<div>Login View</div>} />
        </Routes>
      </div>
      <LocationDisplay />
    </MemoryRouter>
  )
}

describe('NavigationRail Component Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.classList.remove('dark')

    useAuthStore.setState({
      token: 'valid-mock-token',
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 'u-1',
        username: 'alex',
        displayName: 'Alex Tran',
        email: 'alex@example.com',
        avatarUrl: undefined,
        isEmailVerified: true,
        twoFactorEnabled: false,
        createdAt: '2026-10-22T00:00:00.000Z',
      },
    })
  })

  it('renders user avatar with fallback initials and presence dot', () => {
    renderNavigationRail()

    // Avatar link
    expect(screen.getByRole('link', { name: /cài đặt tài khoản/i })).toBeInTheDocument()
    // Fallback initials for 'Alex Tran' -> 'AL'
    expect(screen.getByText('AL')).toBeInTheDocument()
    // Presence dot
    expect(screen.getByTitle('Đang trực tuyến')).toBeInTheDocument()
  })

  it('renders all navigation items and highlights active tab correctly', () => {
    renderNavigationRail('/chat')

    const chatLink = screen.getByRole('link', { name: /đoạn chat/i })
    const friendsLink = screen.getByRole('link', { name: /bạn bè/i })
    const settingsLink = screen.getByRole('link', { name: /cài đặt$/i })

    expect(chatLink).toHaveAttribute('aria-current', 'page')
    expect(chatLink).toHaveClass('bg-brand')

    expect(friendsLink).not.toHaveAttribute('aria-current', 'page')
    expect(settingsLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('highlights friends tab when pathname starts with /friends', () => {
    renderNavigationRail('/friends')

    const friendsLink = screen.getByRole('link', { name: /bạn bè/i })
    const chatLink = screen.getByRole('link', { name: /đoạn chat/i })

    expect(friendsLink).toHaveAttribute('aria-current', 'page')
    expect(friendsLink).toHaveClass('bg-brand')
    expect(chatLink).not.toHaveAttribute('aria-current', 'page')
  })

  it('toggles dark and light mode when clicking theme button', async () => {
    renderNavigationRail()

    const themeBtn = screen.getByRole('button', { name: /chuyển sang giao diện/i })

    // Click to toggle
    await user.click(themeBtn)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('rechat_theme')).toBe('dark')

    // Click again to revert
    await user.click(themeBtn)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('rechat_theme')).toBe('light')
  })

  it('opens logout dialog when clicking logout button and cancels cleanly', async () => {
    renderNavigationRail()

    const logoutTrigger = screen.getByRole('button', { name: /^đăng xuất$/i })
    await user.click(logoutTrigger)

    // Dialog appears
    expect(screen.getByText('Xác nhận đăng xuất')).toBeInTheDocument()
    expect(
      screen.getByText(/bạn có chắc chắn muốn đăng xuất khỏi tài khoản rechat\?/i)
    ).toBeInTheDocument()

    // Cancel button closes dialog
    const cancelBtn = screen.getByRole('button', { name: /hủy bỏ/i })
    await user.click(cancelBtn)

    await waitFor(() => {
      expect(screen.queryByText('Xác nhận đăng xuất')).not.toBeInTheDocument()
    })

    expect(authApi.logout).not.toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('performs full logout flow when confirmed in dialog', async () => {
    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined)

    renderNavigationRail('/chat')

    const logoutTrigger = screen.getByRole('button', { name: /^đăng xuất$/i })
    await user.click(logoutTrigger)

    // Confirm logout
    const confirmLogoutBtn = screen.getByRole('button', { name: 'Đăng xuất' })
    await user.click(confirmLogoutBtn)

    await waitFor(() => {
      expect(authApi.logout).toHaveBeenCalledTimes(1)
      expect(useAuthStore.getState().token).toBeNull()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(toast.success).toHaveBeenCalledWith('Đã đăng xuất tài khoản')
      expect(screen.getByTestId('location-display')).toHaveTextContent('/login')
    })
  })
})
