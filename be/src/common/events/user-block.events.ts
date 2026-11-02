/** Sự kiện chặn người dùng (FR-29, BR-28): phát tới personal room của cả blocker và blocked */
export const USER_BLOCKED = 'user.blocked';
export const USER_UNBLOCKED = 'user.unblocked';

export class UserBlockedEvent {
    constructor(
        public readonly blockerId: string,
        public readonly blockedId: string,
        /** Id hội thoại DIRECT giữa 2 người (nếu đã tồn tại) */
        public readonly conversationId: string | null,
    ) { }
}

export class UserUnblockedEvent {
    constructor(
        public readonly blockerId: string,
        public readonly blockedId: string,
        public readonly conversationId: string | null,
    ) { }
}
