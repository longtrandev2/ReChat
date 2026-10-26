import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MessageSquare, Users, Settings, Sun, Moon, LogOut } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage, PresenceDot } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth.store'
import { useSocket } from '@/hooks/useSocket'
import { authApi } from '@/features/auth/services/auth.api'
import { cn } from '@/lib/utils'

interface NavItem {
  id: 'chat' | 'friends' | 'settings'
  label: string
  path: string
  icon: typeof MessageSquare
}

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Đoạn chat', path: '/chat', icon: MessageSquare },
  { id: 'friends', label: 'Bạn bè', path: '/friends', icon: Users },
  { id: 'settings', label: 'Cài đặt', path: '/settings', icon: Settings },
]

export function NavigationRail() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout: logoutStore } = useAuthStore()
  const { isConnected } = useSocket()

  // State quản lý theme sáng / tối đồng bộ với AuthLayout
  const [isDark, setIsDark] = useState(() => {
    return (
      localStorage.getItem('rechat_theme') === 'dark' ||
      (!('rechat_theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    )
  })

  // State mở modal xác nhận đăng xuất
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('rechat_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('rechat_theme', 'light')
    }
  }, [isDark])

  // Lấy chữ cái đầu làm Avatar Fallback
  const initials = (user?.displayName || user?.username || 'U')
    .slice(0, 2)
    .toUpperCase()

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true)
      await authApi.logout()
    } catch {
      // Vẫn tiếp tục dọn dẹp state ở client dù API logout gặp sự cố
    } finally {
      logoutStore()
      setIsLogoutDialogOpen(false)
      setIsLoggingOut(false)
      toast.success('Đã đăng xuất tài khoản')
      navigate('/login', { replace: true })
    }
  }

  return (
    <aside
      aria-label="Thanh điều hướng chính"
      className="w-16 h-full flex flex-col items-center justify-between py-4 bg-surface dark:bg-surface-dark border-r border-border dark:border-border-dark select-none shrink-0 transition-colors duration-200"
    >
      {/* 1. Header: Avatar người dùng hiện tại */}
      <div className="relative group">
        <Link
          to="/settings"
          title={`Tài khoản: ${user?.displayName || user?.username || ''}`}
          aria-label="Cài đặt tài khoản"
        >
          <Avatar
            size="default"
            className="cursor-pointer transition-transform duration-150 hover:scale-105 ring-2 ring-transparent hover:ring-brand"
          >
            {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.username} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <PresenceDot isOnline={isConnected} />
        </Link>
      </div>

      {/* 2. Menu Tabs: Đoạn chat / Bạn bè / Cài đặt */}
      <nav className="flex flex-col items-center gap-3 w-full px-2" aria-label="Menu chức năng">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive =
            item.path === '/chat'
              ? location.pathname === '/' || location.pathname.startsWith('/chat')
              : location.pathname.startsWith(item.path)

          return (
            <Link
              key={item.id}
              to={item.path}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 group relative',
                isActive
                  ? 'bg-brand text-white shadow-subtle'
                  : 'text-ink-secondary dark:text-ink-secondary-dark hover:text-ink-primary dark:hover:text-ink-primary-dark hover:bg-surface-hover dark:hover:bg-surface-dark-secondary'
              )}
            >
              {/* Modern active / hover indicator pill */}
              <span
                className={cn(
                  'absolute -left-2 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-brand transition-all duration-200 pointer-events-none',
                  isActive
                    ? 'h-6 opacity-100'
                    : 'h-0 opacity-0 group-hover:h-3 group-hover:opacity-60'
                )}
                aria-hidden="true"
              />
              <Icon className="w-5 h-5 transition-transform duration-150 group-hover:scale-110" />
            </Link>
          )
        })}
      </nav>

      {/* 3. Footer Tools: Theme Toggle & Logout */}
      <div className="flex flex-col items-center gap-2 w-full px-2">
        {/* Nút chuyển Dark/Light Mode */}
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          title={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
          aria-label={isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-secondary dark:text-ink-secondary-dark hover:text-brand dark:hover:text-brand-accent hover:bg-surface-hover dark:hover:bg-surface-dark-secondary transition-all duration-150 active:scale-95"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 transition-transform duration-200 rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="w-5 h-5 transition-transform duration-200 rotate-0 hover:-rotate-12" />
          )}
        </button>

        {/* Nút Đăng xuất kèm Dialog xác nhận */}
        <Dialog.Root open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              title="Đăng xuất"
              aria-label="Đăng xuất"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-ink-secondary dark:text-ink-secondary-dark hover:text-coral hover:bg-coral-soft/50 dark:hover:bg-coral/10 transition-all duration-150 active:scale-95"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 animate-in fade-in duration-150" />
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-surface dark:bg-surface-dark border border-border dark:border-border-dark p-6 rounded-2xl shadow-telegram z-50 animate-in zoom-in-95 duration-150 focus:outline-none">
              <Dialog.Title className="text-lg font-bold text-ink-primary dark:text-ink-primary-dark">
                Xác nhận đăng xuất
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ink-secondary dark:text-ink-secondary-dark mt-2 leading-relaxed">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản ReChat? Bạn sẽ cần đăng nhập lại để tiếp tục trò chuyện.
              </Dialog.Description>

              <div className="flex items-center justify-end gap-3 mt-6">
                <Dialog.Close asChild>
                  <Button variant="ghost" disabled={isLoggingOut}>
                    Hủy bỏ
                  </Button>
                </Dialog.Close>
                <Button
                  variant="destructive"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="bg-coral hover:bg-coral/90 text-white"
                >
                  {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
                </Button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </aside>
  )
}
