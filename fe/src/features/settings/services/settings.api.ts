import { apiClient } from '@/services/api.client'
import { mediaApi } from '@/features/chat/services/media.api'
import type { UserProfile } from '@/types/auth.types'
import type {
  ChangePasswordPayload,
  ChangePasswordResponse,
  MessageResponse,
  Send2faSetupOtpResponse,
  SessionDevice,
  UpdateProfilePayload,
} from '../types/settings.types'

/**
 * API Service cho Settings Hub. Header X-Device-Id và Bearer token được apiClient tự động gắn.
 */
export const settingsApi = {
  /** PATCH /api/v1/users/me - cập nhật displayName / avatarUrl */
  updateProfile: async (data: UpdateProfilePayload): Promise<UserProfile> => {
    const res = await apiClient.patch<UserProfile>('/users/me', data)
    return res.data
  },

  /** POST /api/v1/media/upload (dùng lại mediaApi) - trả về URL Cloudinary của ảnh đại diện */
  uploadAvatar: async (file: File): Promise<string> => {
    const uploaded = await mediaApi.uploadMedia(file)
    if (!uploaded.url) {
      throw new Error('Không nhận được đường dẫn ảnh sau khi tải lên')
    }
    return uploaded.url
  },

  /** POST /api/v1/auth/change-password - đăng xuất các thiết bị khác khi thành công */
  changePassword: async (data: ChangePasswordPayload): Promise<ChangePasswordResponse> => {
    const res = await apiClient.post<ChangePasswordResponse>('/auth/change-password', data)
    return res.data
  },

  /** POST /api/v1/auth/2fa/send-setup-otp */
  send2faSetupOtp: async (): Promise<Send2faSetupOtpResponse> => {
    const res = await apiClient.post<Send2faSetupOtpResponse>('/auth/2fa/send-setup-otp')
    return res.data
  },

  /** POST /api/v1/auth/2fa/enable */
  enable2fa: async (otp: string): Promise<MessageResponse> => {
    const res = await apiClient.post<MessageResponse>('/auth/2fa/enable', { otp })
    return res.data
  },

  /** POST /api/v1/auth/2fa/disable */
  disable2fa: async (password: string): Promise<MessageResponse> => {
    const res = await apiClient.post<MessageResponse>('/auth/2fa/disable', { password })
    return res.data
  },

  /** GET /api/v1/auth/sessions */
  getSessions: async (): Promise<SessionDevice[]> => {
    const res = await apiClient.get<SessionDevice[]>('/auth/sessions')
    return res.data || []
  },

  /** DELETE /api/v1/auth/sessions/:deviceId */
  revokeSession: async (deviceId: string): Promise<MessageResponse> => {
    const res = await apiClient.delete<MessageResponse>(`/auth/sessions/${encodeURIComponent(deviceId)}`)
    return res.data
  },
}
