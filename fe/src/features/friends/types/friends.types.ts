export interface FriendUser {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
  friendSince?: string
  isOnline?: boolean
  lastSeen?: string | null
}

export interface FriendRequest {
  id: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  createdAt: string
  requester?: FriendUser
  addressee?: FriendUser
}

export interface FriendsListResponse {
  data: FriendUser[]
  meta?: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface BlockedUser {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
  blockedAt?: string
}

export type FriendsTab = 'all' | 'requests' | 'blocked' | 'find'
