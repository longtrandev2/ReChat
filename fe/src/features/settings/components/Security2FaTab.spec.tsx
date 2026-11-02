import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserProfile } from '@/types/auth.types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../services/settings.api', () => ({
  settingsApi: { send2faSetupOtp: vi.fn(), enable2fa: vi.fn(), disable2fa: vi.fn() },
}))

import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { settingsApi } from '../services/settings.api'
import { Security2FaTab } from './Security2FaTab'

const baseUser: UserProfile = {
  id: 'user-1',
  username: 'alex',
  email: 'alex@rechat.app',
  isEmailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
}

/** Render theo store để phản ánh đúng việc component cập nhật twoFactorEnabled */
function ConnectedTab() {
  const user = useAuthStore((s) => s.user)
  return user ? <Security2FaTab user={user} /> : null
}

describe('Security2FaTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const setUser = (patch: Partial<UserProfile> = {}) =>
    useAuthStore.setState({ user: { ...baseUser, ...patch }, token: 't', isAuthenticated: true })

  it('shows the inactive badge and enable button when 2FA is off', () => {
    setUser()
    render(<ConnectedTab />)

    expect(screen.getByTestId('2fa-status-badge')).toHaveTextContent('Chưa kích hoạt')
    expect(screen.getByRole('button', { name: 'Bật xác thực 2 bước' })).toBeEnabled()
  })

  it('disables enabling 2FA when the account has no email', () => {
    setUser({ email: '' })
    render(<ConnectedTab />)

    expect(screen.getByRole('button', { name: 'Bật xác thực 2 bước' })).toBeDisabled()
  })

  it('enables 2FA: sends OTP, shows countdown, verifies code and flips the store flag', async () => {
    const user = userEvent.setup()
    setUser()
    vi.mocked(settingsApi.send2faSetupOtp).mockResolvedValue({ message: 'sent', maskedEmail: 'a***x@rechat.app' })
    vi.mocked(settingsApi.enable2fa).mockResolvedValue({ message: 'ok' })
    render(<ConnectedTab />)

    await user.click(screen.getByRole('button', { name: 'Bật xác thực 2 bước' }))

    const dialog = await screen.findByTestId('enable-2fa-dialog')
    expect(dialog).toHaveTextContent('a***x@rechat.app')
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('Gửi lại mã sau 01:00')

    await user.click(screen.getAllByRole('textbox')[0])
    await user.paste('654321')

    await waitFor(() => expect(settingsApi.enable2fa).toHaveBeenCalledWith('654321'))
    await waitFor(() => expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true))
    expect(screen.getByTestId('2fa-status-badge')).toHaveTextContent('Đang kích hoạt')
    expect(toast.success).toHaveBeenCalledWith('Đã bật xác thực 2 bước')
  })

  it('keeps the dialog open and reports an error for a wrong OTP', async () => {
    const user = userEvent.setup()
    setUser()
    vi.mocked(settingsApi.send2faSetupOtp).mockResolvedValue({ message: 'sent', maskedEmail: 'a***x@rechat.app' })
    vi.mocked(settingsApi.enable2fa).mockRejectedValue({ response: { data: { message: 'Mã xác thực không chính xác' } } })
    render(<ConnectedTab />)

    await user.click(screen.getByRole('button', { name: 'Bật xác thực 2 bước' }))
    await screen.findByTestId('enable-2fa-dialog')
    await user.click(screen.getAllByRole('textbox')[0])
    await user.paste('000000')

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Mã xác thực không chính xác'))
    expect(screen.getByTestId('enable-2fa-dialog')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(false)
  })

  it('disables 2FA after confirming the account password', async () => {
    const user = userEvent.setup()
    setUser({ twoFactorEnabled: true })
    vi.mocked(settingsApi.disable2fa).mockResolvedValue({ message: 'ok' })
    render(<ConnectedTab />)

    expect(screen.getByTestId('2fa-status-badge')).toHaveTextContent('Đang kích hoạt')
    await user.click(screen.getByRole('button', { name: 'Tắt xác thực 2 bước' }))
    await user.type(await screen.findByLabelText('Mật khẩu hiện tại'), 'Secret@123')
    await user.click(screen.getByRole('button', { name: 'Tắt 2FA' }))

    await waitFor(() => expect(settingsApi.disable2fa).toHaveBeenCalledWith('Secret@123'))
    await waitFor(() => expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(false))
    expect(screen.getByTestId('2fa-status-badge')).toHaveTextContent('Chưa kích hoạt')
  })

  it('shows an inline error when the password to disable 2FA is wrong', async () => {
    const user = userEvent.setup()
    setUser({ twoFactorEnabled: true })
    vi.mocked(settingsApi.disable2fa).mockRejectedValue({
      response: { status: 401, data: { message: 'Mật khẩu không chính xác' } },
    })
    render(<ConnectedTab />)

    await user.click(screen.getByRole('button', { name: 'Tắt xác thực 2 bước' }))
    await user.type(await screen.findByLabelText('Mật khẩu hiện tại'), 'Wrong@123')
    await user.click(screen.getByRole('button', { name: 'Tắt 2FA' }))

    expect(await screen.findByText('Mật khẩu không chính xác')).toBeInTheDocument()
    expect(useAuthStore.getState().user?.twoFactorEnabled).toBe(true)
  })
})
