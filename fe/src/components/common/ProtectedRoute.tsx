import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'

interface ProtectedRouteProps {
  children: ReactNode
}

/**
 * Frontend Route Guard (Equivalent to Spring Security SecurityFilterChain / @PreAuthorize)
 * Prevents unauthorized users from accessing protected views.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthStore()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-canvas-light dark:bg-canvas-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark animate-pulse">
            Đang tải dữ liệu ReChat...
          </p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    // Redirect to login, remembering the attempted path
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
