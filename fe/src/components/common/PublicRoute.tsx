import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { SplashScreen } from '@/components/common/SplashScreen'

interface PublicRouteProps {
  children: ReactNode
}

/**
 * Route Guard cho các trang công khai (Login, Register,...):
 * - Nếu app đang khởi tạo khôi phục phiên (isInitializing): Hiển thị SplashScreen để chờ.
 * - Nếu người dùng đã đăng nhập (isAuthenticated): Chuyển hướng thẳng vào /chat.
 * - Nếu chưa đăng nhập: Cho phép truy cập form.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const { isAuthenticated, isInitializing } = useAuthStore()

  if (isInitializing) {
    return <SplashScreen message="Đang kiểm tra trạng thái đăng nhập..." />
  }

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />
  }

  return <>{children}</>
}
