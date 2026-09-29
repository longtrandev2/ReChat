

export class AuthResponse {
    accessToken: string;
    user: {
        id: string;
        username: string;
        createdAt: Date;
    }
}