

export class AuthResponse {
    accessToken: string;
    user: {
        id: string;
        username: string;
        displayName?: string;
        avatarUrl?: string;
        createdAt: Date;
    };
}