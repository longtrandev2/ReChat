import { useAuthStore } from '@/stores/auth.store'
import type { UserProfile } from '@/types/auth.types'

/**
 * Cập nhật một phần hồ sơ user trong useAuthStore (RAM) để Navigation Rail, Header... đổi theo ngay (BR-40).
 */
export function patchAuthUser(patch: Partial<UserProfile>): void {
  const { user, setUser } = useAuthStore.getState()
  if (user) {
    setUser({ ...user, ...patch })
  }
}
