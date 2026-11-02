import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UserRound, ShieldCheck, MonitorSmartphone, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { authApi } from '@/features/auth/services/auth.api'
import { ProfileTab } from '../components/ProfileTab'
import { Security2FaTab } from '../components/Security2FaTab'
import { SessionsTab } from '../components/SessionsTab'
import { patchAuthUser } from '../utils/patch-auth-user'
import { SETTINGS_TABS, type SettingsTab } from '../types/settings.types'

const TAB_ITEMS: Array<{ id: SettingsTab; label: string; icon: typeof UserRound }> = [
  { id: 'profile', label: 'Hồ sơ & Mật khẩu', icon: UserRound },
  { id: 'security', label: 'Bảo mật & 2FA', icon: ShieldCheck },
  { id: 'sessions', label: 'Thiết bị & Phiên', icon: MonitorSmartphone },
]

const isSettingsTab = (value: string | null): value is SettingsTab =>
  Boolean(value) && SETTINGS_TABS.includes(value as SettingsTab)

/**
 * SettingsPage: Trung tâm Cài đặt & Bảo mật (/settings) - FR-50, BR-40
 * Tab hiện tại đồng bộ với query `?tab=` để có thể chia sẻ / reload đúng tab.
 */
export function SettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : 'profile'

  // Làm mới hồ sơ đầy đủ (email, isEmailVerified, twoFactorEnabled) từ server khi vào trang
  useEffect(() => {
    let isActive = true
    authApi
      .getMe()
      .then((profile) => {
        if (isActive && profile) patchAuthUser(profile)
      })
      .catch(() => {
        // Giữ dữ liệu hiện có trong store; lỗi 401 đã được apiClient xử lý
      })
    return () => {
      isActive = false
    }
  }, [])

  const handleTabChange = (tab: SettingsTab) => {
    setSearchParams(tab === 'profile' ? {} : { tab }, { replace: true })
  }

  return (
    <div
      className="flex-1 flex flex-col h-full bg-gradient-to-b from-[#E8EFF6]/30 via-canvas-light to-[#E1EAF2]/30 dark:from-[#111B27]/40 dark:via-[#0E1621] dark:to-[#0A1017] overflow-hidden"
      data-testid="settings-page"
    >
      <div className="flex-1 flex flex-col min-h-0 max-w-4xl mx-auto w-full p-4 sm:p-6 md:p-8 overflow-hidden">
        {/* Header + Tabs ghim cố định phía trên */}
        <header className="shrink-0 pb-5">
          <h1 className="text-xl sm:text-2xl font-bold text-ink-primary dark:text-ink-primary-dark tracking-tight">
            Cài đặt
          </h1>
          <p className="text-xs sm:text-sm text-ink-secondary dark:text-ink-secondary-dark mt-1 mb-4">
            Quản lý hồ sơ, mật khẩu, xác thực 2 bước và các thiết bị đang đăng nhập
          </p>

          <div
            className="flex items-center gap-1.5 p-1 bg-surface-light-2 dark:bg-[#17212B] rounded-2xl border border-border/60 dark:border-border-dark overflow-x-auto scrollbar-none"
            role="tablist"
          >
            {TAB_ITEMS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-[#242F3D] text-brand dark:text-brand-accent shadow-xs font-semibold'
                      : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  data-testid={`settings-tab-${tab.id}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto pb-6" role="tabpanel">
          {!user ? (
            <div className="flex items-center justify-center py-16 text-ink-muted">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'profile' && <ProfileTab key={user.id} user={user} />}
              {activeTab === 'security' && <Security2FaTab user={user} />}
              {activeTab === 'sessions' && <SessionsTab />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
