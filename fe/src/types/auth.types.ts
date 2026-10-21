/**
 * User & Authentication Types matching NestJS Backend DTOs
 */
export interface UserProfile {
  id: string
  username: string
  email: string
  displayName?: string
  avatarUrl?: string
  isEmailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: string
  updatedAt?: string
}

export interface AuthTokens {
  accessToken: string
}

export interface AuthSuccessResponse {
  accessToken: string
  user: UserProfile
}

export interface Login2FAChallengeResponse {
  requires2FA: true
  mfaToken: string
  message: string
}

export type LoginResult = AuthSuccessResponse | Login2FAChallengeResponse
