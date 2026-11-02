import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { VerifyOtpPage } from './VerifyOtpPage'
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
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
}))

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location-display">{location.pathname + location.search}</div>
}

function renderVerifyOtpPage(initialRoute = '/verify-otp?email=alex%40example.com') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/verify-otp" element={<VerifyOtpPage />} />
        <Route path="/chat" element={<div>Chat Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  )
}

describe('VerifyOtpPage Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().logout()
  })

  it('renders fallback screen when no email query parameter is provided', () => {
    renderVerifyOtpPage('/verify-otp')

    expect(
      screen.getByText(/không tìm thấy thông tin tài khoản cần xác thực/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /quay lại đăng ký/i })).toHaveAttribute(
      'href',
      '/register'
    )
  })

  it('renders email badge, 6 OTP inputs, and disabled submit button initially', () => {
    renderVerifyOtpPage('/verify-otp?email=alex%40example.com')

    expect(screen.getByRole('heading', { name: /xác thực hộp thư/i })).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()

    // 6 digit inputs
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)

    // Submit button is disabled before 6 digits are typed
    const submitBtn = screen.getByRole('button', { name: /xác nhận/i })
    expect(submitBtn).toBeDisabled()
  })

  it('verifies OTP successfully upon entering 6 digits and redirects to /chat', async () => {
    const mockAuthResponse = {
      accessToken: 'token-verified-otp-123',
      user: {
        id: 'user-uuid-88',
        username: 'alex',
        email: 'alex@example.com',
        displayName: 'Alex',
        avatarUrl: undefined,
        isEmailVerified: true,
        twoFactorEnabled: false,
        createdAt: '2026-10-22T00:00:00.000Z',
      },
    }

    vi.mocked(authApi.verifyEmail).mockResolvedValueOnce(mockAuthResponse)

    renderVerifyOtpPage('/verify-otp?email=alex%40example.com')

    const inputs = screen.getAllByRole('textbox')

    // Type 6 digits sequentially
    for (let i = 0; i < 6; i++) {
      await user.type(inputs[i], String(i + 1))
    }

    // Typing 6 digits automatically triggers onComplete -> handleVerify
    await waitFor(() => {
      expect(authApi.verifyEmail).toHaveBeenCalledWith({
        email: 'alex@example.com',
        otp: '123456',
      })
      expect(useAuthStore.getState().token).toBe('token-verified-otp-123')
      expect(useAuthStore.getState().user?.username).toBe('alex')
      expect(toast.success).toHaveBeenCalledWith(
        'Xác thực thành công! Chào mừng alex đến với ReChat.'
      )
      expect(screen.getByTestId('location-display')).toHaveTextContent('/chat')
    })
  })

  it('displays error message and toast when OTP verification fails with bad code', async () => {
    const errorResponse = {
      response: {
        data: {
          message: 'Mã OTP không chính xác hoặc đã hết hạn',
        },
      },
    }

    vi.mocked(authApi.verifyEmail).mockRejectedValueOnce(errorResponse)

    renderVerifyOtpPage('/verify-otp?email=alex%40example.com')

    const inputs = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i++) {
      await user.type(inputs[i], '0')
    }

    const submitBtn = screen.getByRole('button', { name: /xác nhận/i })
    if (!submitBtn.hasAttribute('disabled')) {
      await user.click(submitBtn)
    }

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Mã OTP không chính xác hoặc đã hết hạn')
      expect(
        screen.getByText('Mã OTP không chính xác hoặc đã hết hạn')
      ).toBeInTheDocument()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })
})
