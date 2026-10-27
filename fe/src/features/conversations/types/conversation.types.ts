export type ConversationType = 'DIRECT' | 'GROUP'

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'RAW'

export interface LastMessageSender {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface LastMessage {
  id: string
  content: string
  type: MessageType
  createdAt: string
  sender?: LastMessageSender
}

export interface ConversationMemberUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isOnline?: boolean
  lastSeen?: string
}

export interface ConversationMember {
  id: string
  role: string
  joinedAt?: string
  user: ConversationMemberUser
  lastReadMessageId?: string | null
}

export interface Conversation {
  id: string
  type: ConversationType
  name: string
  avatarUrl: string | null
  unreadCount: number
  lastMessage: LastMessage | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  memberCount?: number
  partnerId?: string
  members?: ConversationMember[]
}

export interface CreateDirectPayload {
  targetUserId: string
}

export interface CreateGroupPayload {
  name: string
  memberIds: string[]
}
