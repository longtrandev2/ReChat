export class FriendRequestSentEvent {
    constructor(
        public readonly requestId: string,
        public readonly requester: {
            id: string;
            username: string;
            displayName: string;
            avatarUrl?: string | null;
        },
        public readonly addresseeId: string,
        public readonly createdAt: Date,
    ) { }
}

export class FriendRequestAcceptedEvent {
    constructor(
        public readonly friendshipId: string,
        public readonly requesterId: string,
        public readonly friend: {
            id: string;
            username: string;
            displayName: string;
            avatarUrl?: string | null;
            isOnline?: boolean;
        },
        public readonly createdAt: Date,
    ) { }
}

export class FriendRequestRejectedEvent {
    constructor(
        public readonly requestId: string,
        public readonly requesterId: string,
    ) { }
}

export class FriendRequestCancelledEvent {
    constructor(
        public readonly requestId: string,
        public readonly addresseeId: string,
    ) { }
}

export class FriendRemovedEvent {
    constructor(
        public readonly userId: string,
        public readonly friendId: string,
    ) { }
}
