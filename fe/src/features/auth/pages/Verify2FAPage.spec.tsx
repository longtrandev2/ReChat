import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Verify2FAPage } from './Verify2FAPage'

vi.mock('@/features/auth/services/auth.api', () => ({
  authApi: { verify2FALogin: vi.fn() },
}))

function renderAt(entry: string | { pathname: string; state?: unknown }) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/verify-2fa" element={<Verify2FAPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Verify2FAPage mfaToken source (FR-26)', () => {
  beforeEach(() => sessionStorage.clear())

  it('accepts mfaToken from router state', () => {
    renderAt({ pathname: '/verify-2fa', state: { mfaToken: 'tok-state' } })
    expect(screen.getByText(/Mã TOTP làm mới/)).toBeInTheDocument()
  })

  it('falls back to sessionStorage after F5', () => {
    sessionStorage.setItem('rechat_mfa_token', 'tok-session')
    renderAt('/verify-2fa')
    expect(screen.getByText(/Mã TOTP làm mới/)).toBeInTheDocument()
  })

  it('ignores the mfaToken query string and shows the fallback when no state/session', () => {
    renderAt('/verify-2fa?mfaToken=leaked')
    expect(screen.getByText(/Quay lại trang Đăng nhập/)).toBeInTheDocument()
  })
})
