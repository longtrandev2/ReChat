import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { RegisterPage } from './RegisterPage'
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
    register: vi.fn(),
  },
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname + location.search}</div>
}

function renderRegisterPage(initialRoute = '/register') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-otp" element={<div>Verify OTP Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  )
}

describe('RegisterPage Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders register form elements and links correctly', () => {
    renderRegisterPage()

    expect(screen.getByRole('heading', { name: /tạo tài khoản/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/tên người dùng/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/địa chỉ email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^mật khẩu$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^xác nhận mật khẩu$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /đăng ký ngay/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /đã có tài khoản\? đăng nhập/i })).toHaveAttribute(
      'href',
      '/login'
    )
  })

  it('validates client-side constraints and displays error messages when fields are empty', async () => {
    renderRegisterPage()

    const submitBtn = screen.getByRole('button', { name: /đăng ký ngay/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByText(/^username từ 3 đến 20 ký tự$/i)).toBeInTheDocument()
      expect(screen.getByText(/^email không được để trống$/i)).toBeInTheDocument()
      expect(screen.getByText(/^mật khẩu phải từ 6 ký tự trở lên$/i)).toBeInTheDocument()
      expect(screen.getByText(/^xác nhận mật khẩu phải từ 6 ký tự trở lên$/i)).toBeInTheDocument()
    })

    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('displays validation error when confirm password does not match password', async () => {
    renderRegisterPage()

    await user.type(screen.getByLabelText(/tên người dùng/i), 'alex_dev')
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'Password123!')
    await user.type(screen.getByLabelText(/^xác nhận mật khẩu$/i), 'DifferentPassword!')

    await user.click(screen.getByRole('button', { name: /đăng ký ngay/i }))

    await waitFor(() => {
      expect(screen.getByText(/mật khẩu xác nhận không khớp/i)).toBeInTheDocument()
    })

    expect(authApi.register).not.toHaveBeenCalled()
  })

  it('registers successfully and navigates to /verify-otp with email query param', async () => {
    const mockUserResponse = {
      id: 'uuid-registered-123',
      username: 'alex_dev',
      email: 'alex@example.com',
      displayName: 'alex_dev',
      avatarUrl: undefined,
      isEmailVerified: false,
      twoFactorEnabled: false,
      createdAt: '2026-10-22T00:00:00.000Z',
    }

    vi.mocked(authApi.register).mockResolvedValueOnce(mockUserResponse)

    renderRegisterPage()

    await user.type(screen.getByLabelText(/tên người dùng/i), 'alex_dev')
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'Password123!')
    await user.type(screen.getByLabelText(/^xác nhận mật khẩu$/i), 'Password123!')

    await user.click(screen.getByRole('button', { name: /đăng ký ngay/i }))

    await waitFor(() => {
      expect(authApi.register).toHaveBeenCalledWith({
        username: 'alex_dev',
        email: 'alex@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      })
      expect(toast.success).toHaveBeenCalledWith(
        'Đăng ký tài khoản thành công! Vui lòng xác thực email.'
      )
      expect(screen.getByTestId('location-display')).toHaveTextContent(
        '/verify-otp?email=alex%40example.com'
      )
    })
  })

  it('handles backend registration conflict error (409) and shows toast error', async () => {
    const errorResponse = {
      response: {
        data: {
          message: 'Email hoặc tên người dùng đã tồn tại trong hệ thống',
        },
      },
    }

    vi.mocked(authApi.register).mockRejectedValueOnce(errorResponse)

    renderRegisterPage()

    await user.type(screen.getByLabelText(/tên người dùng/i), 'alex_dev')
    await user.type(screen.getByLabelText(/địa chỉ email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/^mật khẩu$/i), 'Password123!')
    await user.type(screen.getByLabelText(/^xác nhận mật khẩu$/i), 'Password123!')

    await user.click(screen.getByRole('button', { name: /đăng ký ngay/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Email hoặc tên người dùng đã tồn tại trong hệ thống'
      )
      expect(screen.getByTestId('location-display')).toHaveTextContent('/register')
    })
  })

  it('toggles password and confirm password visibility', async () => {
    renderRegisterPage()

    const passwordInput = screen.getByLabelText(/^mật khẩu$/i)
    const confirmPasswordInput = screen.getByLabelText(/^xác nhận mật khẩu$/i)

    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(confirmPasswordInput).toHaveAttribute('type', 'password')

    const togglePasswordBtn = screen.getByRole('button', { name: 'Hiện mật khẩu' })
    const toggleConfirmBtn = screen.getByRole('button', { name: 'Hiện xác nhận mật khẩu' })

    await user.click(togglePasswordBtn)
    await user.click(toggleConfirmBtn)

    expect(passwordInput).toHaveAttribute('type', 'text')
    expect(confirmPasswordInput).toHaveAttribute('type', 'text')
  })
})
