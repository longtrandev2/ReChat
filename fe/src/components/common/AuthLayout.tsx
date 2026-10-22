import type { ReactNode } from 'react'
import { MessageSquare } from 'lucide-react'

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
}

/**
 * Minimal & Clean Auth Container for ReChat
 * 
 * - Focused single-card layout centered on screen
 * - No marketing fluff or redundant metrics
 * - Clean Lagoon Coral palette (#0B7A6B on warm canvas)
 */
export function AuthLayout({
  children,
  title,
  subtitle,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-canvas-light dark:bg-canvas-dark text-ink-primary dark:text-ink-primary-dark flex flex-col items-center justify-center p-4 sm:p-6 transition-colors duration-200">
      {/* Brand Logo & Name */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center text-white shadow-md shadow-brand/20">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-ink-primary dark:text-ink-primary-dark">
          ReChat
        </h1>
      </div>

      {/* Main Auth Card */}
      <div className="w-full max-w-[420px] bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-semibold text-ink-primary dark:text-ink-primary-dark">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Form Content */}
        {children}
      </div>
    </div>
  )
}
