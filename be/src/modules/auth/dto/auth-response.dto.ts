import type { AuthUserProfile } from '../auth-user.mapper.js';

export class AuthResponse {
    accessToken: string;
    refreshToken?: string;
    user: AuthUserProfile;
}

export class LoginChallengeResponse {
    requires2FA: true;
    mfaToken: string;
    maskedEmail: string;
}

export type LoginResult = AuthResponse | LoginChallengeResponse;
