import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../services/settings.api', () => ({
  settingsApi: { getSessions: vi.fn(), revokeSession: vi.fn() },
}))

import { toast } from 'sonner'
import { DEVICE_ID_STORAGE_KEY } from '@/lib/device-id'
import { settingsApi } from '../services/settings.api'
import type { SessionDevice } from '../types/settings.types'
import { SessionsTab } from './SessionsTab'

const sessions: SessionDevice[] = [
  {
    deviceId: 'phone-1',
    ip: '10.0.0.2',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile Safari/604.1',
    lastActiveAt: new Date().toISOString(),
    isCurrentDevice: false,
  },
  {
    deviceId: 'laptop-1',
    ip: '10.0.0.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    lastActiveAt: new Date().toISOString(),
    isCurrentDevice: false,
  },
]

describe('SessionsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Thiết bị hiện tại được nhận diện qua X-Device-Id lưu trong localStorage
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, 'laptop-1')
  })

  it('lists devices with the current device first, labelled "Thiết bị này" and without a logout button', async () => {
    vi.mocked(settingsApi.getSessions).mockResolvedValue(sessions)
    render(<SessionsTab />)

    const items = await screen.findAllByTestId(/^session-item-/)
    expect(items[0]).toHaveAttribute('data-testid', 'session-item-laptop-1')
    expect(within(items[0]).getByText('Chrome trên Windows')).toBeInTheDocument()
    expect(within(items[0]).getByText('Thiết bị này')).toBeInTheDocument()
    expect(screen.queryByTestId('revoke-session-laptop-1')).not.toBeInTheDocument()

    expect(within(items[1]).getByText('Safari trên iOS')).toBeInTheDocument()
    expect(screen.getByTestId('revoke-session-phone-1')).toBeInTheDocument()
  })

  it('revokes another device after confirmation and removes it from the list', async () => {
    const user = userEvent.setup()
    vi.mocked(settingsApi.getSessions).mockResolvedValue(sessions)
    vi.mocked(settingsApi.revokeSession).mockResolvedValue({ message: 'ok' })
    render(<SessionsTab />)

    await user.click(await screen.findByTestId('revoke-session-phone-1'))
    expect(await screen.findByTestId('revoke-session-dialog')).toHaveTextContent('Safari trên iOS')
    await user.click(screen.getByTestId('confirm-revoke-session'))

    await waitFor(() => expect(settingsApi.revokeSession).toHaveBeenCalledWith('phone-1'))
    await waitFor(() => expect(screen.queryByTestId('session-item-phone-1')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Đã đăng xuất thiết bị')
  })

  it('does not revoke when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    vi.mocked(settingsApi.getSessions).mockResolvedValue(sessions)
    render(<SessionsTab />)

    await user.click(await screen.findByTestId('revoke-session-phone-1'))
    await user.click(within(await screen.findByTestId('revoke-session-dialog')).getByRole('button', { name: 'Hủy' }))

    expect(settingsApi.revokeSession).not.toHaveBeenCalled()
    expect(screen.getByTestId('session-item-phone-1')).toBeInTheDocument()
  })

  it('shows an error state with retry when loading fails', async () => {
    const user = userEvent.setup()
    vi.mocked(settingsApi.getSessions)
      .mockRejectedValueOnce({ response: { data: { message: 'Lỗi máy chủ' } } })
      .mockResolvedValueOnce(sessions)
    render(<SessionsTab />)

    expect(await screen.findByText('Lỗi máy chủ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))

    expect(await screen.findByTestId('session-item-laptop-1')).toBeInTheDocument()
    expect(settingsApi.getSessions).toHaveBeenCalledTimes(2)
  })
})
