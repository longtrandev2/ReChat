import { apiClient } from '@/services/api.client'
import type {
  AuthSuccessResponse,
  Login2FAChallengeResponse,
  UserProfile,
} from '@/types/auth.types'

export interface LoginPayload {
  usernameOrEmail: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface VerifyEmailPayload {
  email: string
  otp: string
}

export interface Verify2FAPayload {
  mfaToken: string
  otp: string
}

export const authApi = {
  /**
   * POST /api/v1/auth/login
   * Returns JWT token + User or 2FA challenge
   */
  login: async (data: LoginPayload): Promise<AuthSuccessResponse | Login2FAChallengeResponse> => {
    // Determine whether usernameOrEmail is an email or username
    const payload = data.usernameOrEmail.includes('@')
      ? { email: data.usernameOrEmail, password: data.password }
      : { username: data.usernameOrEmail, password: data.password }

    const res = await apiClient.post<AuthSuccessResponse | Login2FAChallengeResponse>(
      '/auth/login',
      payload
    )
    return res.data
  },

  /**
   * POST /api/v1/auth/register
   */
  register: async (data: RegisterPayload): Promise<UserProfile> => {
    const res = await apiClient.post<UserProfile>('/auth/register', data)
    return res.data
  },

  /**
   * POST /api/v1/auth/verify-email
   */
  verifyEmail: async (data: VerifyEmailPayload): Promise<AuthSuccessResponse> => {
    const res = await apiClient.post<AuthSuccessResponse>('/auth/verify-email', data)
    return res.data
  },

  /**
   * POST /api/v1/auth/resend-verification
   */
  resendVerification: async (email: string): Promise<{ message: string }> => {
    const res = await apiClient.post<{ message: string }>('/auth/resend-verification', { email })
    return res.data
  },

  /**
   * POST /api/v1/auth/2fa/verify-login
   */
  verify2FALogin: async (data: Verify2FAPayload): Promise<AuthSuccessResponse> => {
    const res = await apiClient.post<AuthSuccessResponse>('/auth/2fa/verify-login', data)
    return res.data
  },

  /**
   * POST /api/v1/auth/logout
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout')
    } finally {
      localStorage.removeItem('rechat_access_token')
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  getMe: async (): Promise<UserProfile> => {
    const res = await apiClient.get<UserProfile>('/auth/me')
    return res.data
  },
}
