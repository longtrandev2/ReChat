import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { SplashScreen } from '@/components/common/SplashScreen'

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Frontend Route Guard:
 * Chặn người dùng chưa xác thực truy cập vào màn hình chính.
 * Khi app đang khởi tạo (F5 / cold start), hiển thị SplashScreen để chống nháy màn hình.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isInitializing, isLoading } = useAuthStore()
  const location = useLocation()

  // Chặn Gate: Nếu đang khôi phục phiên từ Cookie, hiển thị SplashScreen cao cấp
  if (isInitializing || isLoading) {
    return <SplashScreen message="Đang xác thực phiên làm việc ReChat..." />
  }

  if (!isAuthenticated) {
    // Redirect to login, remembering the attempted path
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
