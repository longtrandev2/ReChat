export type MessageType = 'TEXT' | 'IMAGE' | 'RAW'

export interface MessageSender {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export interface Message {
  id: string
  content: string
  type: MessageType
  fileUrl?: string | null
  replyToId?: string | null
  isRecalled: boolean
  createdAt: string
  updatedAt: string
  sender: MessageSender
}

export interface GetMessagesQuery {
  before?: string
  limit?: number
}

export interface SendMessagePayload {
  content: string
  type?: MessageType
  fileUrl?: string
  replyToId?: string
}
