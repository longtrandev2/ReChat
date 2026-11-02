import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { UserProfile } from '@/types/auth.types'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../services/settings.api', () => ({
  settingsApi: { updateProfile: vi.fn(), uploadAvatar: vi.fn(), changePassword: vi.fn() },
}))

import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { settingsApi } from '../services/settings.api'
import { ProfileTab } from './ProfileTab'

const mockUser: UserProfile = {
  id: 'user-1',
  username: 'alex_tr',
  email: 'alex@rechat.app',
  displayName: 'Alex Tran',
  isEmailVerified: true,
  twoFactorEnabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
}

describe('ProfileTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: mockUser, token: 't', isAuthenticated: true, isInitializing: false })
  })

  it('renders account info with verified email badge and member-since date', () => {
    render(<ProfileTab user={mockUser} />)

    expect(screen.getByText('@alex_tr')).toBeInTheDocument()
    expect(screen.getByText('alex@rechat.app')).toBeInTheDocument()
    expect(screen.getByText('Đã xác thực')).toBeInTheDocument()
    expect(screen.getByText('01/10/2026')).toBeInTheDocument()
    expect(screen.getByLabelText('Tên hiển thị')).toHaveValue('Alex Tran')
  })

  it('saves a new display name and syncs it into useAuthStore', async () => {
    const user = userEvent.setup()
    vi.mocked(settingsApi.updateProfile).mockResolvedValue({ ...mockUser, displayName: 'Alex Mới' })
    render(<ProfileTab user={mockUser} />)

    const input = screen.getByLabelText('Tên hiển thị')
    await user.clear(input)
    await user.type(input, 'Alex Mới')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() => expect(settingsApi.updateProfile).toHaveBeenCalledWith({ displayName: 'Alex Mới' }))
    expect(useAuthStore.getState().user?.displayName).toBe('Alex Mới')
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật tên hiển thị')
  })

  it('blocks an empty display name', async () => {
    const user = userEvent.setup()
    render(<ProfileTab user={mockUser} />)

    await user.clear(screen.getByLabelText('Tên hiển thị'))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByText('Tên hiển thị không được để trống')).toBeInTheDocument()
    expect(settingsApi.updateProfile).not.toHaveBeenCalled()
  })

  it('uploads an avatar, saves its URL and updates the store (Navigation Rail avatar)', async () => {
    const user = userEvent.setup()
    vi.mocked(settingsApi.uploadAvatar).mockResolvedValue('https://cdn/avatar.png')
    vi.mocked(settingsApi.updateProfile).mockResolvedValue({ ...mockUser, avatarUrl: 'https://cdn/avatar.png' })
    render(<ProfileTab user={mockUser} />)

    const file = new File(['img'], 'me.png', { type: 'image/png' })
    await user.upload(screen.getByTestId('avatar-file-input'), file)

    await waitFor(() => expect(settingsApi.updateProfile).toHaveBeenCalledWith({ avatarUrl: 'https://cdn/avatar.png' }))
    expect(settingsApi.uploadAvatar).toHaveBeenCalledWith(file)
    expect(useAuthStore.getState().user?.avatarUrl).toBe('https://cdn/avatar.png')
    expect(toast.success).toHaveBeenCalledWith('Đã cập nhật ảnh đại diện')
  })

  it('rejects unsupported avatar files before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<ProfileTab user={mockUser} />)

    await user.upload(screen.getByTestId('avatar-file-input'), new File(['x'], 'doc.pdf', { type: 'application/pdf' }))

    expect(toast.error).toHaveBeenCalledWith('Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF')
    expect(settingsApi.uploadAvatar).not.toHaveBeenCalled()
  })
})
