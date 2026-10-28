

export class AuthResponse {
    accessToken: string;
    refreshToken?: string;
    user: {
        id: string;
        username: string;
        displayName?: string;
        avatarUrl?: string;
        createdAt: Date;
    };
}

export class LoginChallengeResponse {
    requires2FA: true;
    mfaToken: string;
    maskedEmail: string;
}

export type LoginResult = AuthResponse | LoginChallengeResponse;