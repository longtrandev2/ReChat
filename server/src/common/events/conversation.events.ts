export class ConversationCreatedEvent {
    constructor(
        public readonly conversationId: string,
        public readonly memberIds: string[],
        public readonly conversation: any,
    ) { }
}

export class InboxUpdatedEvent {
    constructor(
        public readonly conversationId: string,
        public readonly memberIds: string[],
        public readonly lastMessage: {
            id: string;
            content: string;
            type: string;
            fileUrl?: string | null;
            senderName: string;
            createdAt: Date;
        },
        public readonly senderId: string,
    ) { }
}

export class GroupMemberEvent {
    constructor(
        public readonly conversationId: string,
        public readonly action: 'ADDED' | 'REMOVED' | 'LEFT',
        public readonly actor: {
            id: string;
            displayName: string;
        },
        public readonly targetUserIds: string[],
        public readonly members?: any[],
    ) { }
}

export class MessagePinnedEvent {
    constructor(
        public readonly conversationId: string,
        public readonly messageId: string,
        public readonly isPinned: boolean,
        public readonly message?: {
            id: string;
            content: string;
            senderName?: string;
        },
        public readonly pinnedBy?: {
            id: string;
            displayName: string;
        },
    ) { }
}

export class MessageRecalledEvent {
    constructor(
        public readonly conversationId: string,
        public readonly messageId: string,
        public readonly recalledAt: Date,
        public readonly senderId: string,
        public readonly isLastMessage?: boolean,
        public readonly memberIds?: string[],
    ) { }
}

export class MessageEditedEvent {
    constructor(
        public readonly conversationId: string,
        public readonly messageId: string,
        public readonly content: string,
        public readonly editedAt: Date,
        public readonly senderId: string,
        public readonly isLastMessage?: boolean,
        public readonly memberIds?: string[],
    ) { }
}

export class MessageReactionEvent {
    constructor(
        public readonly conversationId: string,
        public readonly messageId: string,
        public readonly user: {
            id: string;
            displayName: string;
            avatarUrl?: string;
        },
        public readonly emoji: string,
        public readonly action: 'ADDED' | 'REMOVED' | 'CHANGED',
    ) { }
}

