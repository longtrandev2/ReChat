/**
 * Settings Hub (/settings) types - khớp DTO backend (FR-25, FR-27, FR-49, FR-50)
 */
export type SettingsTab = 'profile' | 'security' | 'sessions'

export const SETTINGS_TABS: SettingsTab[] = ['profile', 'security', 'sessions']

export interface UpdateProfilePayload {
  displayName?: string
  avatarUrl?: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export interface MessageResponse {
  message: string
}

export interface ChangePasswordResponse extends MessageResponse {
  /** Số thiết bị khác đã bị đăng xuất sau khi đổi mật khẩu */
  revokedSessions: number
}

export interface Send2faSetupOtpResponse extends MessageResponse {
  maskedEmail: string
}

/** Phiên đăng nhập trả về từ GET /auth/sessions */
export interface SessionDevice {
  deviceId: string
  ip?: string
  userAgent?: string
  lastActiveAt?: string
  isCurrentDevice: boolean
}
