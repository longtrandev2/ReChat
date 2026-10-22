import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { LoginPage } from './LoginPage'
import { authApi } from '@/features/auth/services/auth.api'
import { useAuthStore } from '@/stores/auth.store'

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
    login: vi.fn(),
  },
}))

// Helper component to track navigation destination in MemoryRouter
function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname + location.search}</div>
}

function renderLoginPage(initialRoute = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/chat" element={<div>Chat Page</div>} />
        <Route path="/verify-2fa" element={<div>2FA Verification Page</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  )
}

describe('LoginPage Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().logout()
  })

  it('renders login form elements and links correctly', () => {
    renderLoginPage()

    expect(screen.getByRole('heading', { name: /đăng nhập rechat/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/tài khoản hoặc email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^mật khẩu/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tiếp tục/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quên mật khẩu\?/i })).toHaveAttribute(
      'href',
      '/forgot-password'
    )
    expect(screen.getByRole('link', { name: /đăng ký tài khoản mới/i })).toHaveAttribute(
      'href',
      '/register'
    )
  })

  it('blocks submission and displays client-side validation errors when fields are empty', async () => {
    renderLoginPage()

    const submitBtn = screen.getByRole('button', { name: /tiếp tục/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/tài khoản hoặc email phải có ít nhất 3 ký tự/i)).toBeInTheDocument()
      expect(screen.getByText(/mật khẩu phải có ít nhất 6 ký tự/i)).toBeInTheDocument()
    })

    expect(authApi.login).not.toHaveBeenCalled()
  })

  it('logs in successfully and redirects to /chat while updating auth store', async () => {
    const mockAuthResponse = {
      accessToken: 'mock-jwt-token-xyz',
      user: {
        id: 'user-uuid-1',
        username: 'alex',
        email: 'alex@example.com',
        displayName: 'Alex Tran',
        avatarUrl: undefined,
        isEmailVerified: true,
        twoFactorEnabled: false,
        createdAt: '2026-10-20T00:00:00.000Z',
      },
    }

    vi.mocked(authApi.login).mockResolvedValueOnce(mockAuthResponse)

    renderLoginPage()

    const accountInput = screen.getByLabelText(/tài khoản hoặc email/i)
    const passwordInput = screen.getByLabelText(/^mật khẩu/i)
    const submitBtn = screen.getByRole('button', { name: /tiếp tục/i })

    await user.type(accountInput, 'alex')
    await user.type(passwordInput, 'Password123!')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        usernameOrEmail: 'alex',
        password: 'Password123!',
      })
    })

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('mock-jwt-token-xyz')
      expect(useAuthStore.getState().user?.username).toBe('alex')
      expect(toast.success).toHaveBeenCalledWith('Chào mừng trở lại, alex!')
      expect(screen.getByTestId('location-display')).toHaveTextContent('/chat')
    })
  })

  it('redirects to /verify-2fa when backend responds with 2FA challenge', async () => {
    const mock2FAResponse = {
      requires2FA: true as const,
      mfaToken: 'mfa-temp-token-999',
      message: 'Tài khoản yêu cầu mã xác thực 2 lớp (2FA)',
    }

    vi.mocked(authApi.login).mockResolvedValueOnce(mock2FAResponse)

    renderLoginPage()

    const accountInput = screen.getByLabelText(/tài khoản hoặc email/i)
    const passwordInput = screen.getByLabelText(/^mật khẩu/i)
    const submitBtn = screen.getByRole('button', { name: /tiếp tục/i })

    await user.type(accountInput, 'alex2fa@example.com')
    await user.type(passwordInput, 'SecretPassword123!')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Tài khoản yêu cầu mã xác thực 2 lớp (2FA)')
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/verify-2fa?mfaToken=mfa-temp-token-999'
      )
      // Store must not have token yet
      expect(useAuthStore.getState().token).toBeNull()
    })
  })

  it('handles bad credentials error (401) and shows toast error without redirecting', async () => {
    const errorResponse = {
      response: {
        data: {
          message: 'Tài khoản hoặc mật khẩu không chính xác',
        },
      },
    }

    vi.mocked(authApi.login).mockRejectedValueOnce(errorResponse)

    renderLoginPage()

    const accountInput = screen.getByLabelText(/tài khoản hoặc email/i)
    const passwordInput = screen.getByLabelText(/^mật khẩu/i)
    const submitBtn = screen.getByRole('button', { name: /tiếp tục/i })

    await user.type(accountInput, 'wrong_user')
    await user.type(passwordInput, 'WrongPass123!')
    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Tài khoản hoặc mật khẩu không chính xác')
      expect(screen.getByTestId('location-display')).toHaveTextContent('/login')
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })

  it('toggles password visibility when clicking eye button', async () => {
    renderLoginPage()

    const passwordInput = screen.getByLabelText(/^mật khẩu/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    const toggleBtn = screen.getByRole('button', { name: /hiện mật khẩu/i })
    await user.click(toggleBtn)

    expect(passwordInput).toHaveAttribute('type', 'text')

    const hideBtn = screen.getByRole('button', { name: /ẩn mật khẩu/i })
    await user.click(hideBtn)

    expect(passwordInput).toHaveAttribute('type', 'password')
  })
})
