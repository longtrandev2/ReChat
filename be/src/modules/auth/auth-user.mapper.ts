import type { User } from '../users/entities/user.entity.js';

/**
 * Hồ sơ user trả về trong mọi response xác thực (login, verify-email, verify-2fa, refresh).
 * Phải chứa đủ email / isEmailVerified / twoFactorEnabled để FE (useAuthStore) không bị mất
 * các trường này sau mỗi lần silent refresh.
 */
export interface AuthUserProfile {
    id: string;
    username: string;
    email?: string;
    isEmailVerified: boolean;
    twoFactorEnabled: boolean;
    displayName?: string;
    avatarUrl?: string;
    createdAt: Date;
}

export function toAuthUser(user: User): AuthUserProfile {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        isEmailVerified: Boolean(user.isEmailVerified),
        twoFactorEnabled: Boolean(user.twoFactorEnabled),
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
    };
}
