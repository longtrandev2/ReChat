export type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'RAW'

export interface MessageSender {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface MessageReactionGroup {
  emoji: string
  count: number
  users: Array<{ id: string; displayName: string }>
  hasReacted?: boolean
}

export interface ParentMessageSummary {
  id: string
  content: string
  type: MessageType
  fileUrl?: string | null
  fileSize?: number | null
  isRecalled: boolean
  createdAt: string
  sender: MessageSender
}

export interface Message {
  id: string
  content: string
  type: MessageType
  fileUrl?: string | null
  fileSize?: number | null
  replyToId?: string | null
  replyTo?: ParentMessageSummary | null
  isRecalled: boolean
  isEdited?: boolean
  editedAt?: string | null
  reactions?: MessageReactionGroup[]
  createdAt: string
  updatedAt: string
  sender: MessageSender
}

export interface ReactionUpdateEvent {
  conversationId: string
  messageId: string
  emoji: string
  action: 'ADDED' | 'REMOVED' | 'CHANGED'
  user: {
    id: string
    displayName?: string
    username?: string
  }
}

export interface MessageRecalledEvent {
  conversationId: string
  messageId: string
  content: string
  isRecalled: boolean
}

export interface MessageEditedEvent {
  conversationId: string
  messageId: string
  content: string
  isEdited: boolean
  editedAt: string
}

export interface GetMessagesQuery {
  before?: string
  limit?: number
  type?: MessageType
}

export interface SendMessagePayload {
  content: string
  type?: MessageType
  fileUrl?: string
  fileSize?: number
  replyToId?: string
}
