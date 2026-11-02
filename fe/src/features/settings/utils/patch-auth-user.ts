import { useAuthStore } from '@/stores/auth.store'
import { postAuthBroadcast } from '@/lib/auth-broadcast'
import type { UserProfile } from '@/types/auth.types'

/**
 * Cập nhật một phần hồ sơ user trong useAuthStore (RAM) để Navigation Rail, Header... đổi theo ngay (BR-40),
 * đồng thời phát sang các tab khác qua BroadcastChannel.
 */
export function patchAuthUser(patch: Partial<UserProfile>): void {
  const { user, setUser } = useAuthStore.getState()
  if (user) {
    const next = { ...user, ...patch }
    setUser(next)
    postAuthBroadcast({ type: 'AUTH_USER_UPDATED', payload: { user: next } })
  }
}
