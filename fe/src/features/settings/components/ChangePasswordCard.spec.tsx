import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../services/settings.api', () => ({
  settingsApi: { changePassword: vi.fn() },
}))

import { toast } from 'sonner'
import { settingsApi } from '../services/settings.api'
import { ChangePasswordCard } from './ChangePasswordCard'

async function fillForm(current: string, next: string, confirm: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Mật khẩu hiện tại'), current)
  await user.type(screen.getByLabelText('Mật khẩu mới'), next)
  await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), confirm)
  await user.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }))
}

describe('ChangePasswordCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validates password strength and confirmation before calling the API', async () => {
    render(<ChangePasswordCard />)

    await fillForm('OldPass@1', 'weakpass', 'different')

    expect(await screen.findByText('Mật khẩu mới phải có chữ hoa, chữ thường, chữ số và ký tự đặc biệt')).toBeInTheDocument()
    expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument()
    expect(settingsApi.changePassword).not.toHaveBeenCalled()
  })

  it('submits, shows a success toast with the number of logged-out devices and resets the form', async () => {
    vi.mocked(settingsApi.changePassword).mockResolvedValue({ message: 'ok', revokedSessions: 2 })
    render(<ChangePasswordCard />)

    await fillForm('OldPass@1', 'NewPass@2', 'NewPass@2')

    await waitFor(() =>
      expect(settingsApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass@1',
        newPassword: 'NewPass@2',
        confirmPassword: 'NewPass@2',
      })
    )
    expect(toast.success).toHaveBeenCalledWith('Đổi mật khẩu thành công', {
      description: 'Đã đăng xuất 2 thiết bị khác để bảo vệ tài khoản.',
    })
    await waitFor(() => expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveValue(''))
    expect(screen.getByLabelText('Mật khẩu mới')).toHaveValue('')
  })

  it('shows the server error inline under the current password field on 401', async () => {
    vi.mocked(settingsApi.changePassword).mockRejectedValue({
      response: { status: 401, data: { message: 'Mật khẩu hiện tại không chính xác', errorCode: 'INVALID_CURRENT_PASSWORD' } },
    })
    render(<ChangePasswordCard />)

    await fillForm('Wrong@123', 'NewPass@2', 'NewPass@2')

    expect(await screen.findByText('Mật khẩu hiện tại không chính xác')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('toggles password visibility with the eye button', async () => {
    const user = userEvent.setup()
    render(<ChangePasswordCard />)
    const input = screen.getByLabelText('Mật khẩu mới')

    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu mới' }))
    expect(input).toHaveAttribute('type', 'text')
  })
})
