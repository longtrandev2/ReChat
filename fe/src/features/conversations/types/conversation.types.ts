export type ConversationType = 'DIRECT' | 'GROUP'

export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'RAW' | 'SYSTEM'

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

export type ConversationRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface ConversationMember {
  id: string
  role: ConversationRole | string
  joinedAt?: string
  user: ConversationMemberUser
  lastReadMessageId?: string | null
  isMuted?: boolean
}

export interface Conversation {
  id: string
  type: ConversationType
  name: string
  avatarUrl: string | null
  quickEmoji?: string
  unreadCount: number
  isMuted?: boolean
  lastMessage: LastMessage | null
  lastMessageAt: string
  createdAt: string
  updatedAt: string
  memberCount?: number
  partnerId?: string
  isOnline?: boolean
  members?: ConversationMember[]
}

export interface CreateDirectPayload {
  targetUserId: string
}

export interface CreateGroupPayload {
  name: string
  memberIds: string[]
}

export interface UpdateGroupPayload {
  name?: string
  avatarUrl?: string
}

export interface UpdateQuickEmojiPayload {
  emoji: string
}

export interface AddMembersPayload {
  memberIds: string[]
}

export interface UpdateMemberRolePayload {
  role: 'ADMIN' | 'MEMBER'
}

export interface TransferOwnerPayload {
  newOwnerId: string
}
