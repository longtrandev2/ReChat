export type ConversationType = 'DIRECT' | 'GROUP'

export type MessageType = 'TEXT' | 'IMAGE' | 'RAW'

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
}

export interface CreateDirectPayload {
  targetUserId: string
}

export interface CreateGroupPayload {
  name: string
  memberIds: string[]
}
